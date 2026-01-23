import argparse
import os
import random
import sqlite3
import sys
from datetime import datetime, timedelta, timezone


SAMPLE_POSTS = [
    ("矿大哪个食堂最好吃？", "最近总不知道吃什么，求推荐。"),
    ("大二 CS 选课求助", "想选计网/OS，学长学姐给点建议。"),
    ("丢了一张校园卡...", "在三食堂附近丢的，有捡到的同学联系我。"),
    ("期末复习资料求分享", "有没有离散/高数复习资料？"),
    ("宿舍空调维修渠道", "空调不制冷，有没有靠谱报修？"),
    ("图书馆自习室占座", "现在占座还严重吗？"),
    ("校园跑腿推荐", "有没有便宜的跑腿小哥/平台？"),
    ("考研自习搭子", "找个考研搭子一起打卡。"),
    ("校园网速度慢", "晚上打游戏延迟高，怎么办？"),
    ("社团活动推荐", "想认识新朋友，有哪些好玩的社团？"),
]


def rfc3339(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ensure_counter_at_least(conn: sqlite3.Connection, name: str, min_value: int) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO counters(name, value) VALUES(?, ?);",
        (name, min_value),
    )
    conn.execute(
        "UPDATE counters SET value = CASE WHEN value < ? THEN ? ELSE value END WHERE name = ?;",
        (min_value, min_value, name),
    )


def next_counter(conn: sqlite3.Connection, name: str) -> int:
    conn.execute("INSERT OR IGNORE INTO counters(name, value) VALUES(?, 0);", (name,))
    conn.execute("UPDATE counters SET value = value + 1 WHERE name = ?;", (name,))
    row = conn.execute("SELECT value FROM counters WHERE name = ?;", (name,)).fetchone()
    return int(row[0])


def max_seq(conn: sqlite3.Connection, table: str) -> int:
    row = conn.execute(f"SELECT COALESCE(MAX(seq), 0) FROM {table};").fetchone()
    return int(row[0] or 0)


def fetch_board_ids(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute("SELECT id FROM boards ORDER BY seq ASC;").fetchall()
    if rows:
        return [row[0] for row in rows]
    return ["b_1", "b_2", "b_3"]


def seed_users(conn: sqlite3.Connection, count: int, run_id: str) -> list[str]:
    user_ids: list[str] = []
    base_time = datetime.now(timezone.utc)
    for i in range(count):
        seq = next_counter(conn, "user")
        user_id = f"u_{seq}"
        nickname = f"虚拟用户{i + 1:03d}"
        created_at = rfc3339(base_time - timedelta(days=random.randint(0, 90)))
        conn.execute(
            "INSERT INTO users(seq, id, nickname, avatar, cover, bio, created_at) "
            "VALUES(?, ?, ?, '', '', '', ?);",
            (seq, user_id, nickname, created_at),
        )
        account = f"seed_{run_id}_{i + 1:03d}"
        conn.execute(
            "INSERT INTO accounts(account, user_id, password_hash) VALUES(?, ?, ?);",
            (account, user_id, ""),
        )
        user_ids.append(user_id)
    return user_ids


def seed_posts(
    conn: sqlite3.Connection,
    count: int,
    user_ids: list[str],
    board_ids: list[str],
    likes_per_post: int,
    liked_every: int,
) -> tuple[list[tuple[str, str]], int]:
    posts: list[tuple[str, str]] = []
    base_time = datetime.now(timezone.utc)
    for i in range(count):
        seq = next_counter(conn, "post")
        post_id = f"p_{seq}"
        board_id = random.choice(board_ids)
        author_id = random.choice(user_ids)
        title, content = SAMPLE_POSTS[i % len(SAMPLE_POSTS)]
        content = f"{content}（帖子 {i + 1}）"
        created_at = rfc3339(
            base_time - timedelta(days=random.randint(0, 30), seconds=random.randint(0, 86400))
        )
        conn.execute(
            "INSERT INTO posts(seq, id, board_id, author_id, title, content, content_json, "
            "tags, attachments, created_at, deleted_at) "
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);",
            (seq, post_id, board_id, author_id, title, content, "", "", "", created_at),
        )
        posts.append((post_id, created_at))

    liked_every = max(1, liked_every)
    liked_indices = set(range(0, count, liked_every))
    like_user_count = min(likes_per_post, len(user_ids))
    liked_posts = 0
    for idx, (post_id, created_at) in enumerate(posts):
        if idx not in liked_indices or like_user_count <= 0:
            continue
        liked_posts += 1
        for user_id in user_ids[:like_user_count]:
            conn.execute(
                "INSERT INTO post_votes(post_id, user_id, value, created_at) VALUES(?, ?, ?, ?);",
                (post_id, user_id, 1, created_at),
            )
    return posts, liked_posts


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed fake users and posts into SQLite.")
    parser.add_argument(
        "--db",
        default=os.path.join("server", "storage", "dev.db"),
        help="Path to sqlite database file.",
    )
    parser.add_argument("--users", type=int, default=50, help="Number of fake users to add.")
    parser.add_argument("--posts", type=int, default=200, help="Number of fake posts to add.")
    parser.add_argument(
        "--likes-per-post",
        type=int,
        default=50,
        help="Likes to add on selected posts.",
    )
    parser.add_argument(
        "--liked-every",
        type=int,
        default=5,
        help="Every Nth post will receive likes.",
    )
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Database not found: {args.db}", file=sys.stderr)
        return 1

    random.seed(42)
    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON;")

    try:
        with conn:
            ensure_counter_at_least(conn, "user", max_seq(conn, "users"))
            ensure_counter_at_least(conn, "post", max_seq(conn, "posts"))

            run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            user_ids = seed_users(conn, args.users, run_id)
            board_ids = fetch_board_ids(conn)
            posts, liked_posts = seed_posts(
                conn,
                args.posts,
                user_ids,
                board_ids,
                args.likes_per_post,
                args.liked_every,
            )

        print(
            "Seeded users: {users}, posts: {posts}, posts with likes: {liked_posts}".format(
                users=len(user_ids),
                posts=len(posts),
                liked_posts=liked_posts,
            )
        )
        if args.likes_per_post > len(user_ids):
            print(
                "Warning: likes_per_post exceeds user count; likes capped to {cap}.".format(
                    cap=len(user_ids)
                )
            )
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
