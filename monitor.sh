#!/bin/bash

PORT=3000

while true; do
    # 检查端口是否被占用
    PID=$(lsof -ti tcp:$PORT)
    if [ -n "$PID" ]; then
        echo "端口 $PORT 被占用，正在杀死进程 $PID..."
        kill -9 $PID
    fi

    # 启动 npm run dev，并将输出重定向到 out.log
    npm run dev >> out.log 2>&1 &
    NPM_PID=$!
    echo "已启动 npm run dev, 进程ID为 $NPM_PID"

    # 监控 out.log 文件的新内容
    tail -n0 -F out.log | while read LINE; do
        # 检查日志内容中是否包含 IMAP connection closed、IMAP connection ended、IMAP connection error 或 app crashed
        echo "$LINE" | grep -q -E "IMAP connection (closed|ended|error)"
        if [ $? -eq 0 ]; then
            echo "检测到 IMAP connection closed 或 IMAP connection ended 或 IMAP connection error, 正在重新启动 npm run dev..."
            kill -9 $NPM_PID
            break
        fi

        echo "$LINE" | grep -q "app crashed"
        if [ $? -eq 0 ]; then
            echo "检测到 app crashed，正在重新启动 npm run dev..."
            kill -9 $NPM_PID
            break
        fi
    done

    # 等待 npm run dev 进程退出
    wait $NPM_PID
    echo "npm run dev 已退出, 100秒后重新启动..."
    sleep 100
done
