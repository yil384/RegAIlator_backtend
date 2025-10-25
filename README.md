# Run

First, start a new session (any name is ok).
```
tmux new -s regailator123
```
Second, in the session, run:
```
./monitor.sh 
```
Last, exit with:
```
Ctrl + b  d
```

# Tips
Besides, to enter next time, use:
```
tmux attach -t regailator123
```

To kill:
```
tmux kill-session -t regailator123
```