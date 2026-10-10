//! Durable Agent history, bounded working context, and route-scoped memories.
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    fs,
    path::Path,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const CONTEXT_CHARS: usize = 30_000;
const MEMORY_CHARS: usize = 8_000;
const PAGE_SIZE: usize = 100;
static INITIALIZATION_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Serialize)]
pub struct Message {
    pub id: i64,
    pub role: String,
    pub text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub route: String,
    pub source: String,
    pub title: String,
    pub updated_at: i64,
    pub message_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationPage {
    pub id: String,
    pub route: String,
    pub messages: Vec<Message>,
    pub has_older: bool,
    pub run_id: Option<String>,
}

#[derive(Serialize)]
pub struct Memory {
    pub id: String,
    pub content: String,
}

pub struct Context {
    pub summary: String,
    pub messages: Vec<Message>,
}
pub struct Compaction {
    pub through: i64,
    pub input: String,
}

pub struct Store {
    db: Connection,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn source(route: &str) -> String {
    if route.starts_with("weixin-") {
        "微信"
    } else if route.starts_with("telegram-") {
        "Telegram"
    } else {
        "桌面"
    }
    .into()
}

impl Store {
    pub fn open(root: &Path) -> Result<Self, String> {
        // Changing journal mode and creating the schema must not race on first use.
        let _initialization = INITIALIZATION_LOCK
            .lock()
            .map_err(|_| "Agent storage initialization lock failed")?;
        fs::create_dir_all(root).map_err(|_| "Could not create Agent storage")?;
        let db = Connection::open(root.join("history.sqlite")).map_err(|e| e.to_string())?;
        db.busy_timeout(Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        db.execute_batch("PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY, route TEXT NOT NULL, title TEXT NOT NULL,
                updated_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1,
                summary TEXT NOT NULL DEFAULT '', summary_through INTEGER NOT NULL DEFAULT 0);
            CREATE UNIQUE INDEX IF NOT EXISTS active_route ON conversations(route) WHERE active=1;
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL REFERENCES conversations(id),
                role TEXT NOT NULL, text TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS conversation_messages ON messages(conversation_id,id);
            CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, route TEXT NOT NULL, content TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS legacy_imports (route TEXT PRIMARY KEY);")
            .map_err(|e| e.to_string())?;
        let mut store = Self { db };
        store.import_legacy(root)?;
        Ok(store)
    }

    fn import_legacy(&mut self, root: &Path) -> Result<(), String> {
        let directory = root.join("conversations");
        if !directory.exists() {
            return Ok(());
        }
        for entry in fs::read_dir(directory).map_err(|_| "Could not read legacy Agent history")? {
            let path = entry
                .map_err(|_| "Could not read legacy Agent history")?
                .path();
            if path.extension().is_none_or(|ext| ext != "json") {
                continue;
            }
            let Some(route) = path.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };
            crate::agent::validate_conversation_id(route)?;
            if self
                .db
                .query_row(
                    "SELECT 1 FROM legacy_imports WHERE route=?1",
                    [route],
                    |_| Ok(()),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .is_some()
            {
                continue;
            }
            let messages: Vec<Value> = serde_json::from_str(
                &fs::read_to_string(&path).map_err(|_| "Could not read legacy Agent history")?,
            )
            .map_err(|_| "Legacy Agent conversation is invalid")?;
            let tx = self
                .db
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .map_err(|e| e.to_string())?;
            if tx
                .query_row(
                    "SELECT 1 FROM legacy_imports WHERE route=?1",
                    [route],
                    |_| Ok(()),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .is_some()
            {
                continue;
            }
            let id = uuid::Uuid::new_v4().to_string();
            tx.execute("INSERT INTO conversations(id,route,title,updated_at,active) VALUES(?1,?2,'Coffee Agent',?3,?4)",
                params![id, route, path.metadata().ok().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as i64).unwrap_or_else(now_ms),
                    !tx.query_row("SELECT EXISTS(SELECT 1 FROM conversations WHERE route=?1 AND active=1)", [route], |r| r.get::<_, bool>(0)).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
            for message in messages {
                let role = message["role"]
                    .as_str()
                    .filter(|r| matches!(*r, "user" | "assistant"))
                    .ok_or("Invalid legacy message role")?;
                let text = message["text"]
                    .as_str()
                    .ok_or("Invalid legacy message text")?;
                tx.execute(
                    "INSERT INTO messages(conversation_id,role,text) VALUES(?1,?2,?3)",
                    params![id, role, text],
                )
                .map_err(|e| e.to_string())?;
                if role == "user" {
                    tx.execute(
                        "UPDATE conversations SET title=?2 WHERE id=?1 AND title='Coffee Agent'",
                        params![id, title(text)],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
            tx.execute("INSERT INTO legacy_imports(route) VALUES(?1)", [route])
                .map_err(|e| e.to_string())?;
            tx.commit().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn resolve(&mut self, id_or_route: &str) -> Result<String, String> {
        crate::agent::validate_conversation_id(id_or_route)?;
        if let Some(id) = self
            .db
            .query_row(
                "SELECT id FROM conversations WHERE id=?1",
                [id_or_route],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
        {
            return Ok(id);
        }
        if id_or_route != "desktop"
            && !id_or_route.starts_with("weixin-")
            && !id_or_route.starts_with("telegram-")
        {
            return Err("Agent conversation does not exist".into());
        }
        let tx = self
            .db
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(|e| e.to_string())?;
        if let Some(id) = tx
            .query_row(
                "SELECT id FROM conversations WHERE route=?1 AND active=1",
                [id_or_route],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
        {
            return Ok(id);
        }
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO conversations(id,route,title,updated_at) VALUES(?1,?2,'新对话',?3)",
            params![id, id_or_route, now_ms()],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub fn route(&self, id: &str) -> Result<String, String> {
        self.db
            .query_row("SELECT route FROM conversations WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .map_err(|_| "Agent conversation does not exist".into())
    }

    pub fn new_conversation(&mut self, route: &str) -> Result<String, String> {
        crate::agent::validate_conversation_id(route)?;
        let id = uuid::Uuid::new_v4().to_string();
        let tx = self.db.transaction().map_err(|e| e.to_string())?;
        tx.execute("UPDATE conversations SET active=0 WHERE route=?1", [route])
            .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO conversations(id,route,title,updated_at) VALUES(?1,?2,'新对话',?3)",
            params![id, route, now_ms()],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub fn append(&mut self, id: &str, role: &str, text: &str) -> Result<(), String> {
        let tx = self.db.transaction().map_err(|e| e.to_string())?;
        if role == "user" {
            tx.execute("UPDATE conversations SET title=?2 WHERE id=?1 AND NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id=?1 AND role='user')", params![id,title(text)]).map_err(|e| e.to_string())?;
        }
        tx.execute(
            "INSERT INTO messages(conversation_id,role,text) VALUES(?1,?2,?3)",
            params![id, role, text],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE conversations SET updated_at=?2 WHERE id=?1",
            params![id, now_ms()],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn activate(&mut self, id: &str) -> Result<(), String> {
        let route = self.route(id)?;
        let tx = self.db.transaction().map_err(|e| e.to_string())?;
        tx.execute("UPDATE conversations SET active=0 WHERE route=?1", [&route])
            .map_err(|e| e.to_string())?;
        tx.execute("UPDATE conversations SET active=1 WHERE id=?1", [id])
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn list(&self) -> Result<Vec<Conversation>, String> {
        let mut statement = self.db.prepare("SELECT c.id,c.route,c.title,c.updated_at,COUNT(m.id) FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id AND m.role!='tool' GROUP BY c.id ORDER BY c.updated_at DESC").map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([], |r| {
                let route: String = r.get(1)?;
                Ok(Conversation {
                    id: r.get(0)?,
                    source: source(&route),
                    route,
                    title: r.get(2)?,
                    updated_at: r.get(3)?,
                    message_count: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    pub fn page(&self, id: &str, before: Option<i64>) -> Result<ConversationPage, String> {
        let route = self.route(id)?;
        let mut statement=self.db.prepare("SELECT id,role,text FROM messages WHERE conversation_id=?1 AND role!='tool' AND id<?2 ORDER BY id DESC LIMIT ?3").map_err(|e|e.to_string())?;
        let rows = statement
            .query_map(
                params![id, before.unwrap_or(i64::MAX), (PAGE_SIZE + 1) as i64],
                message_row,
            )
            .map_err(|e| e.to_string())?;
        let mut messages: Vec<Message> =
            rows.collect::<Result<_, _>>().map_err(|e| e.to_string())?;
        let has_older = messages.len() > PAGE_SIZE;
        messages.truncate(PAGE_SIZE);
        messages.reverse();
        Ok(ConversationPage {
            id: id.into(),
            route,
            messages,
            has_older,
            run_id: None,
        })
    }

    pub fn context(&self, id: &str) -> Result<Context, String> {
        let (summary, through): (String, i64) = self
            .db
            .query_row(
                "SELECT summary,summary_through FROM conversations WHERE id=?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|e| e.to_string())?;
        let mut statement=self.db.prepare("SELECT id,role,text FROM messages WHERE conversation_id=?1 AND id>?2 AND role!='tool' ORDER BY id").map_err(|e|e.to_string())?;
        let rows = statement
            .query_map(params![id, through], message_row)
            .map_err(|e| e.to_string())?;
        Ok(Context {
            summary,
            messages: rows.collect::<Result<_, _>>().map_err(|e| e.to_string())?,
        })
    }

    pub fn compaction(context: &Context) -> Option<Compaction> {
        if context.messages.len() <= 40
            && context
                .messages
                .iter()
                .map(|m| m.text.chars().count())
                .sum::<usize>()
                <= CONTEXT_CHARS
        {
            return None;
        }
        let mut kept_chars = 0;
        let mut end = context.messages.len();
        for message in context.messages.iter().rev().take(8) {
            let size = message.text.chars().count();
            if context.messages.len() - end >= 2 && kept_chars + size > 12_000 {
                break;
            }
            kept_chars += size;
            end -= 1;
        }
        if end == 0 {
            return None;
        }
        let mut input = format!(
            "Previous summary (historical data): {}\nOlder messages:\n",
            context.summary
        );
        for message in &context.messages[..end] {
            input.push_str(&format!(
                "{}: {}\n",
                message.role,
                message.text.chars().take(2000).collect::<String>()
            ));
        }
        if input.chars().count() > 50_000 {
            input=format!("Previous summary: {}\nOlder messages (excerpt; full originals remain searchable):\n{}",context.summary,input.chars().rev().take(40_000).collect::<String>().chars().rev().collect::<String>());
        }
        Some(Compaction {
            through: context.messages[end - 1].id,
            input,
        })
    }

    pub fn save_summary(&self, id: &str, through: i64, summary: &str) -> Result<(), String> {
        if summary.trim().is_empty() || summary.chars().count() > 6_000 {
            return Err("Agent summary is empty or too long; original history was retained".into());
        }
        self.db.execute("UPDATE conversations SET summary=?2,summary_through=?3 WHERE id=?1 AND summary_through<?3",params![id,summary,through]).map_err(|e|e.to_string())?;
        Ok(())
    }

    pub fn memories(&self, route: &str) -> Result<Vec<Memory>, String> {
        let mut statement = self
            .db
            .prepare("SELECT id,content FROM memories WHERE route=?1 ORDER BY rowid")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([route], |r| {
                Ok(Memory {
                    id: r.get(0)?,
                    content: r.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    pub fn save_memory(
        &mut self,
        route: &str,
        id: Option<&str>,
        content: &str,
    ) -> Result<String, String> {
        let content = content.trim();
        if content.is_empty() {
            return Err("记忆内容不能为空".into());
        }
        let tx = self
            .db
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(|e| e.to_string())?;
        let memories = {
            let mut statement = tx
                .prepare("SELECT id,content FROM memories WHERE route=?1")
                .map_err(|e| e.to_string())?;
            let rows = statement
                .query_map([route], |r| {
                    Ok(Memory {
                        id: r.get(0)?,
                        content: r.get(1)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };
        if id.is_some_and(|id| !memories.iter().any(|memory| memory.id == id)) {
            return Err("Memory does not exist in this identity".into());
        }
        if let Some(existing) = memories
            .iter()
            .find(|m| m.content == content && id.is_none())
        {
            return Ok(existing.id.clone());
        }
        let count = memories
            .iter()
            .filter(|memory| Some(memory.id.as_str()) != id)
            .map(|memory| memory.content.chars().count())
            .sum::<usize>()
            + content.chars().count();
        if count > MEMORY_CHARS {
            return Err("长期记忆已满（8000 字符），请先修改或忘记旧记忆".into());
        }
        let id = id
            .map(str::to_string)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        tx.execute("INSERT INTO memories(id,route,content) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET content=excluded.content",params![id,route,content]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub fn forget_memory(&self, route: &str, id: &str) -> Result<(), String> {
        let changed = self
            .db
            .execute(
                "DELETE FROM memories WHERE route=?1 AND id=?2",
                params![route, id],
            )
            .map_err(|e| e.to_string())?;
        if changed == 0 {
            return Err("Memory does not exist in this identity".into());
        }
        Ok(())
    }

    pub fn search(&self, route: &str, query: &str) -> Result<Value, String> {
        if query.trim().is_empty() {
            return Err("Enter a history search keyword".into());
        }
        let mut statement=self.db.prepare("SELECT m.id,m.conversation_id,m.role,m.text,c.title FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.route=?1 AND instr(lower(m.text),lower(?2))>0 ORDER BY m.id DESC LIMIT 8").map_err(|e|e.to_string())?;
        let rows=statement.query_map(params![route,query.trim()],|r| {
            let text:String=r.get(3)?;
            let start=text.to_ascii_lowercase().find(&query.trim().to_ascii_lowercase()).unwrap_or(0);
            let char_start=text[..start.min(text.len())].chars().count().saturating_sub(100);
            let excerpt:String=text.chars().skip(char_start).take(1000).collect();
            Ok(json!({"messageId":r.get::<_,i64>(0)?,"conversationId":r.get::<_,String>(1)?,"role":r.get::<_,String>(2)?,"text":excerpt,"title":r.get::<_,String>(4)?,"historical":true}))
        }).map_err(|e|e.to_string())?;
        Ok(json!({"matches":rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?}))
    }
}

fn title(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(40)
        .collect()
}
fn message_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    Ok(Message {
        id: r.get(0)?,
        role: r.get(1)?,
        text: r.get(2)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("coffee-memory-{}", uuid::Uuid::new_v4()))
    }
    #[test]
    fn archive_survives_compaction_new_conversation_and_restart() {
        let directory = root();
        let mut store = Store::open(&directory).unwrap();
        let id = store.resolve("desktop").unwrap();
        for n in 0..70 {
            store
                .append(
                    &id,
                    if n % 2 == 0 { "user" } else { "assistant" },
                    &format!("第{n}条，工作目录 E:\\项目"),
                )
                .unwrap();
        }
        let plan = Store::compaction(&store.context(&id).unwrap()).unwrap();
        store
            .save_summary(
                &id,
                plan.through,
                "用户正在 E:\\项目 工作；当前终端状态须重新查询。",
            )
            .unwrap();
        assert_eq!(store.context(&id).unwrap().messages.len(), 8);
        assert_eq!(store.page(&id, None).unwrap().messages.len(), 70);
        let memory = store.save_memory("desktop", None, "回复使用中文").unwrap();
        let next = store.new_conversation("desktop").unwrap();
        assert_ne!(next, id);
        assert_eq!(store.memories("desktop").unwrap()[0].id, memory);
        assert!(store.context(&next).unwrap().messages.is_empty());
        drop(store);
        let mut reopened = Store::open(&directory).unwrap();
        assert_eq!(reopened.resolve("desktop").unwrap(), next);
        assert_eq!(reopened.list().unwrap().len(), 2);
        assert_eq!(
            reopened.search("desktop", "第0条").unwrap()["matches"][0]["conversationId"],
            id
        );
        reopened.activate(&id).unwrap();
        assert_eq!(reopened.resolve("desktop").unwrap(), id);
        assert_eq!(reopened.memories("desktop").unwrap()[0].id, memory);
        drop(reopened);
        fs::remove_dir_all(directory).unwrap();
    }
    #[test]
    fn migration_is_once_only_and_identity_memory_is_isolated() {
        let directory = root();
        fs::create_dir_all(directory.join("conversations")).unwrap();
        fs::write(
            directory.join("conversations/desktop.json"),
            r#"[{"role":"user","text":"旧对话"},{"role":"assistant","text":"保留历史"}]"#,
        )
        .unwrap();
        let mut store = Store::open(&directory).unwrap();
        let id = store.resolve("desktop").unwrap();
        let memory = store.save_memory("desktop", None, "偏好中文").unwrap();
        assert!(store
            .save_memory("weixin-account", Some(&memory), "覆盖他人记忆")
            .is_err());
        assert!(store.forget_memory("weixin-account", &memory).is_err());
        assert!(store.memories("weixin-account").unwrap().is_empty());
        assert_eq!(
            store.search("weixin-account", "旧对话").unwrap()["matches"]
                .as_array()
                .unwrap()
                .len(),
            0
        );
        assert!(store.save_summary(&id, 1, "").is_err());
        assert_eq!(store.context(&id).unwrap().messages.len(), 2);
        drop(store);
        let store = Store::open(&directory).unwrap();
        assert_eq!(store.page(&id, None).unwrap().messages.len(), 2);
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }
    #[test]
    fn paging_and_memory_limits_preserve_existing_data() {
        let directory = root();
        let mut store = Store::open(&directory).unwrap();
        let id = store.resolve("desktop").unwrap();
        for n in 0..110 {
            store.append(&id, "user", &format!("消息 {n}")).unwrap();
        }
        let newest = store.page(&id, None).unwrap();
        assert!(newest.has_older);
        assert_eq!(newest.messages.len(), 100);
        let older = store.page(&id, Some(newest.messages[0].id)).unwrap();
        assert_eq!(older.messages.len(), 10);
        assert!(!older.has_older);
        let content = "中".repeat(MEMORY_CHARS);
        let memory = store.save_memory("desktop", None, &content).unwrap();
        assert!(store.save_memory("desktop", None, "额外").is_err());
        assert_eq!(store.memories("desktop").unwrap()[0].content, content);
        store
            .save_memory("desktop", Some(&memory), "新的偏好")
            .unwrap();
        store.forget_memory("desktop", &memory).unwrap();
        assert!(store.memories("desktop").unwrap().is_empty());
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn concurrent_readers_import_once_and_share_one_current_thread() {
        let directory = root();
        fs::create_dir_all(directory.join("conversations")).unwrap();
        fs::write(
            directory.join("conversations/desktop.json"),
            r#"[{"role":"user","text":"原始历史"}]"#,
        )
        .unwrap();
        let workers: Vec<_> = (0..4)
            .map(|n| {
                let directory = directory.clone();
                std::thread::spawn(move || {
                    let mut store = Store::open(&directory).unwrap();
                    let id = store.resolve("desktop").unwrap();
                    store.append(&id, "user", &format!("同时请求 {n}")).unwrap();
                    id
                })
            })
            .collect();
        let ids: Vec<_> = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect();
        assert!(ids.iter().all(|id| id == &ids[0]));
        let store = Store::open(&directory).unwrap();
        assert_eq!(store.list().unwrap().len(), 1);
        assert_eq!(store.page(&ids[0], None).unwrap().messages.len(), 5);
        assert!(directory.join("conversations/desktop.json").exists());
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn concurrent_memory_writes_enforce_capacity_atomically() {
        let directory = root();
        drop(Store::open(&directory).unwrap());
        let workers: Vec<_> = ['a', 'b']
            .into_iter()
            .map(|letter| {
                let directory = directory.clone();
                std::thread::spawn(move || {
                    Store::open(&directory).unwrap().save_memory(
                        "desktop",
                        None,
                        &letter.to_string().repeat(5000),
                    )
                })
            })
            .collect();
        let successes = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .filter(Result::is_ok)
            .count();
        assert_eq!(successes, 1);
        let store = Store::open(&directory).unwrap();
        assert_eq!(store.memories("desktop").unwrap().len(), 1);
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }
}
