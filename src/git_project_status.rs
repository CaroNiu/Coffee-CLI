//! Read-only sidebar metadata. Never fetch, switch branches, or change Git config.
use crate::git::project_git_output as git;
use serde::Serialize;
use serde_json::Value;
use std::{collections::HashMap, sync::{OnceLock, atomic::{AtomicU64, Ordering}}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

#[derive(Clone, Serialize)]
pub struct PullRequest {
    number: u64,
    url: String,
    state: String,
    ci: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct ProjectStatus {
    repo_root: String,
    branch: String,
    pull_request: Option<PullRequest>,
    // unavailable is different from a successful lookup with no matching PR.
    github: String,
}

#[derive(Clone, PartialEq, Debug)]
struct GitHubRepo { owner: String, name: String }

fn github_repo(remote: &str) -> Option<GitHubRepo> {
    let remote = remote.trim();
    let path = if let Some(path) = remote.strip_prefix("git@github.com:") {
        path.to_string()
    } else {
        let url = reqwest::Url::parse(remote).ok()?;
        if url.host_str()? != "github.com" || !matches!(url.scheme(), "https" | "ssh") { return None; }
        url.path().trim_start_matches('/').to_string()
    };
    let path = path.trim_end_matches('/').trim_end_matches(".git");
    let (owner, name) = path.split_once('/')?;
    if owner.is_empty() || name.is_empty() || name.contains('/')
        || !owner.bytes().chain(name.bytes()).all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b)) { return None; }
    Some(GitHubRepo { owner: owner.into(), name: name.into() })
}

fn select_pr<'a>(rows: &'a Value, head: &GitHubRepo, branch: &str) -> Option<&'a Value> {
    let matches = || rows.as_array().into_iter().flatten().filter(|pr| {
        pr["head"]["ref"].as_str() == Some(branch)
            && pr["head"]["repo"]["full_name"].as_str().is_some_and(|name| name.eq_ignore_ascii_case(&format!("{}/{}", head.owner, head.name)))
    });
    // API rows are newest-updated first. An open PR outranks an older closed one.
    matches().find(|pr| pr["state"] == "open").or_else(|| matches().next())
}

fn ci_state(status: &Value, checks: &Value) -> Option<String> {
    let contexts = status["statuses"].as_array()?;
    let runs = checks["check_runs"].as_array()?;
    // A partial page cannot establish that every check passed.
    let incomplete = status["total_count"].as_u64().unwrap_or(0) > contexts.len() as u64
        || checks["total_count"].as_u64().unwrap_or(0) > runs.len() as u64;
    let mut states = Vec::new();
    for context in contexts {
        states.push(match context["state"].as_str() {
            Some("failure" | "error") => "failure", Some("pending") => "pending", Some("success") => "success", _ => "unknown",
        });
    }
    for run in runs {
        states.push(if run["status"] != "completed" { "pending" } else { match run["conclusion"].as_str() {
            Some("failure" | "timed_out" | "action_required" | "startup_failure") => "failure",
            Some("success" | "neutral" | "skipped") => "success", _ => "unknown",
        }});
    }
    if states.contains(&"failure") { Some("failure".into()) }
    else if states.contains(&"pending") { Some("pending".into()) }
    else if !states.is_empty() && !incomplete && !states.contains(&"unknown") { Some("success".into()) }
    else { None }
}

type CachedPr = (Instant, Option<PullRequest>, bool);
static CACHE: OnceLock<tokio::sync::Mutex<HashMap<String, CachedPr>>> = OnceLock::new();
static RATE_LIMIT_UNTIL: AtomicU64 = AtomicU64::new(0);

async fn github_json(request: reqwest::RequestBuilder) -> Option<Value> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    if now < RATE_LIMIT_UNTIL.load(Ordering::Relaxed) { return None; }
    let response = request.send().await.ok()?;
    if response.headers().get("x-ratelimit-remaining").and_then(|value| value.to_str().ok()) == Some("0")
        || response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let reset = response.headers().get("x-ratelimit-reset").and_then(|value| value.to_str().ok()).and_then(|value| value.parse::<u64>().ok()).unwrap_or(now + 600);
        RATE_LIMIT_UNTIL.store(reset.max(now + 60), Ordering::Relaxed);
    }
    response.error_for_status().ok()?.json().await.ok()
}

async fn read_pr(base: &GitHubRepo, head: &GitHubRepo, branch: &str, local_head: &str) -> (Option<PullRequest>, bool) {
    let token = std::env::var("GH_TOKEN").or_else(|_| std::env::var("GITHUB_TOKEN")).ok().filter(|token| !token.trim().is_empty());
    let ttl = if token.is_some() { 60 } else { 600 };
    let key = format!("{}/{}/{}/{}/{}/{}", base.owner, base.name, head.owner, head.name, branch, local_head);
    // Serializes refreshes as well as deduplicating requests from shared worktrees.
    let mut cache = CACHE.get_or_init(Default::default).lock().await;
    if let Some((at, pr, available)) = cache.get(&key) {
        if at.elapsed() < Duration::from_secs(ttl) { return (pr.clone(), *available); }
    }
    cache.retain(|_, (at, _, _)| at.elapsed() < Duration::from_secs(1200));
    let query = async {
        let client = reqwest::Client::builder().timeout(Duration::from_secs(8)).redirect(reqwest::redirect::Policy::none()).user_agent("Coffee-CLI").build().ok()?;
        let get = |url: reqwest::Url| {
            let request = client.get(url).header("Accept", "application/vnd.github+json");
            if let Some(token) = &token { request.bearer_auth(token) } else { request }
        };
        let root = format!("https://api.github.com/repos/{}/{}", base.owner, base.name);
        let mut url = reqwest::Url::parse(&format!("{root}/pulls")).ok()?;
        url.query_pairs_mut().extend_pairs([("state", "all"), ("head", &format!("{}:{branch}", head.owner)), ("sort", "updated"), ("direction", "desc"), ("per_page", "30")]);
        let rows = github_json(get(url)).await?;
        if !rows.is_array() { return None; }
        let Some(pr) = select_pr(&rows, head, branch) else { return Some(None); };
        let state = if !pr["merged_at"].is_null() { "merged" } else if pr["state"] == "closed" { "closed" } else if pr["draft"] == true { "draft" } else { "open" };
        let mut result = PullRequest { number: pr["number"].as_u64()?, url: pr["html_url"].as_str()?.into(), state: state.into(), ci: None };
        // CI belongs to the remote PR commit, never an unpushed local commit.
        if state == "open" && pr["head"]["sha"].as_str() == Some(local_head) {
            let ci = async {
                let status = github_json(get(reqwest::Url::parse(&format!("{root}/commits/{local_head}/status?per_page=100")).ok()?)).await?;
                let checks = github_json(get(reqwest::Url::parse(&format!("{root}/commits/{local_head}/check-runs?filter=latest&per_page=100")).ok()?)).await?;
                ci_state(&status, &checks)
            };
            result.ci = ci.await;
        }
        Some(Some(result))
    };
    let observation = tokio::time::timeout(Duration::from_secs(12), query).await.ok().flatten();
    let available = observation.is_some();
    let pr = observation.flatten();
    cache.insert(key, (Instant::now(), pr.clone(), available));
    (pr, available)
}

#[tauri::command]
pub async fn git_project_status(folder: String) -> Result<Option<ProjectStatus>, String> {
    let local = tauri::async_runtime::spawn_blocking(move || {
        let root = git(&folder, &["rev-parse", "--show-toplevel"]).ok()?.trim().to_string();
        let branch = git(&root, &["symbolic-ref", "--short", "HEAD"]).unwrap_or_default().trim().to_string();
        let head = git(&root, &["rev-parse", "--verify", "HEAD"]).unwrap_or_default().trim().to_string();
        let origin = git(&root, &["config", "--get", "remote.origin.url"]).ok().and_then(|remote| github_repo(&remote));
        let upstream = git(&root, &["config", "--get", "remote.upstream.url"]).ok().and_then(|remote| github_repo(&remote));
        Some((root, branch, head, origin, upstream))
    }).await.map_err(|error| error.to_string())?;
    let Some((root, branch, head, origin, upstream)) = local else { return Ok(None); };
    let mut result = ProjectStatus { repo_root: root.replace('\\', "/"), branch: if branch.is_empty() { format!("({})", &head[..head.len().min(7)]) } else { branch.clone() }, pull_request: None, github: "not_github".into() };
    if let Some(origin) = origin.filter(|_| !branch.is_empty()) {
        let base = upstream.as_ref().unwrap_or(&origin);
        let (pr, available) = read_pr(base, &origin, &branch, &head).await;
        result.pull_request = pr;
        result.github = if available { "ok" } else { "unavailable" }.into();
    }
    Ok(Some(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn only_github_remotes_supply_api_identity() {
        let expected = Some(GitHubRepo { owner: "owner".into(), name: "repo".into() });
        for remote in ["git@github.com:owner/repo.git", "https://github.com/owner/repo.git", "ssh://git@github.com/owner/repo"] { assert_eq!(github_repo(remote), expected); }
        for remote in ["https://github.com.evil.test/owner/repo", "https://gitlab.com/owner/repo", "file:///owner/repo", "git@github.com:owner/repo/extra"] { assert_eq!(github_repo(remote), None); }
    }
    #[test]
    fn pr_selection_requires_exact_branch_and_head_repository() {
        let head = GitHubRepo { owner: "fork".into(), name: "repo".into() };
        let rows = json!([
            {"number":1,"state":"open","head":{"ref":"feature","repo":{"full_name":"other/repo"}}},
            {"number":2,"state":"closed","head":{"ref":"feature","repo":{"full_name":"fork/repo"}}},
            {"number":3,"state":"open","head":{"ref":"feature","repo":{"full_name":"fork/repo"}}}
        ]);
        assert_eq!(select_pr(&rows, &head, "feature").unwrap()["number"], 3);
        assert!(select_pr(&rows, &head, "main").is_none());
    }
    #[test]
    fn ci_failure_pending_and_missing_evidence_are_distinct() {
        let status = json!({"total_count":0,"statuses":[]});
        let checks = |runs: Value| json!({"total_count":runs.as_array().unwrap().len(),"check_runs":runs});
        assert_eq!(ci_state(&status, &checks(json!([]))), None);
        assert_eq!(ci_state(&status, &checks(json!([{"status":"completed","conclusion":"success"}]))), Some("success".into()));
        assert_eq!(ci_state(&status, &checks(json!([{"status":"queued"}]))), Some("pending".into()));
        assert_eq!(ci_state(&status, &checks(json!([{"status":"completed","conclusion":"failure"},{"status":"queued"}]))), Some("failure".into()));
        assert_eq!(ci_state(&status, &checks(json!([{"status":"completed","conclusion":"cancelled"}]))), None);
        assert_eq!(ci_state(&status, &json!({"total_count":101,"check_runs":[{"status":"completed","conclusion":"success"}]})), None);
        assert_eq!(ci_state(&status, &Value::Null), None);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn local_branch_identity_follows_the_exact_worktree() {
        let root = std::env::temp_dir().join(format!("coffee-sidebar-git-{}", uuid::Uuid::new_v4()));
        let repo = root.join("repo");
        let worktree = root.join("worktree");
        std::fs::create_dir_all(&repo).unwrap();
        let run = |args: &[&str]| {
            let mut command = std::process::Command::new("git");
            command.arg("-C").arg(&repo).args(args);
            #[cfg(windows)]
            { use std::os::windows::process::CommandExt; command.creation_flags(0x0800_0000); }
            assert!(command.output().unwrap().status.success());
        };
        run(&["init", "-b", "main"]);
        run(&["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "fixture"]);
        run(&["worktree", "add", "-b", "feature/isolated", worktree.to_str().unwrap()]);
        let main = git_project_status(repo.to_string_lossy().into()).await.unwrap().unwrap();
        let isolated = git_project_status(worktree.to_string_lossy().into()).await.unwrap().unwrap();
        assert_eq!(main.branch, "main");
        assert_eq!(isolated.branch, "feature/isolated");
        assert_ne!(main.repo_root, isolated.repo_root);
        assert_eq!(isolated.github, "not_github");
        assert!(isolated.pull_request.is_none());
        assert!(git_project_status(root.to_string_lossy().into()).await.unwrap().is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
}
