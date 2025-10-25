# Run

## Openai Key
First, create a new key file: ```src/python/include/openai_key.in``` which contains:
```
sk-proj-xxxx
```
as the whole content of the file.

## Install
install the node_modules with:
```
npm install
```
Start mongoDB
```
brew services start mongodb-community@6.0
```

## Run
If you are in dev mode, you can run:
```
npm run dev
```
If you are on the server (prod env), start a new session (any name is ok).
```
tmux new -s regailator123
```
in the session, run:
```
./monitor.sh 
```
You can exit with:
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