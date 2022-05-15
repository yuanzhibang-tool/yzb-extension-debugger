import { ChildProcess } from 'child_process';

const server = require('server');
const { get, post } = server.router;
const { fork } = require('child_process');

class DebuggerLogger {
  static echoMessageTypeTitle(message: string) {
    console.log(`\u001b[1;31m * ${message}`);
  }
  static echoMessageInfoTitle(message: string) {
    console.log(`\u001b[1;32m - ${message}`);
  }
  static echoMessageDataTitle(message: string) {
    console.log(`\u001b[1;33m $ ${message}`);
  }
  static echoMessageDeliver() {
    console.log(`\u001b[1;35m -------------------------- *${Date()}* --------------------------`);
  }
  static echoRendererOtherMessage(message: any) {
    DebuggerLogger.echoMessageDeliver();
    DebuggerLogger.echoMessageTypeTitle('Sender not callback message to renderer');
    DebuggerLogger.echoMessageDataTitle('callback data below');
    console.log(message);
    DebuggerLogger.echoMessageDeliver();
  }
}

class Debugger {
  nextCallbackMap = new Map();
  errorCallbackMap = new Map();
  extensionProcess: ChildProcess | null = null;
  // 用来生成identity系数,identity为自增状态
  messageIdentityIndex = 0;
  rendererTopicMessageCallback: ((topic: string, message: any) => {}) | null = null;
  rendererOtherMessageCallback: ((message: any) => {}) | null = null;

  setRendererTopicMessageCallback(callback: (topic: string, message: any) => {}) {
    this.rendererTopicMessageCallback = callback;
  }

  setRendererOtherMessageCallback(callback: (message: any) => {}) {
    this.rendererOtherMessageCallback = callback;
  }

  sendMessageToProcess(message) {
    return new Promise((resolve, reject) => {
      const identity = message.identity;
      this.nextCallbackMap.set(identity, resolve);
      this.errorCallbackMap.set(identity, reject);
      this.extensionProcess?.send(message);
    });
  }

  startServer(port: number = 8888) {
    server({ port, security: { csrf: false } }, [
      get('/', ctx => {
        return 'Hello world';
      }),
      post('/*', ctx => {
        const url = ctx.url;
        const body = ctx.body;
        const topic = url.slice(1);
        this.messageIdentityIndex++;
        const messageIdentityString = `identity-${this.messageIdentityIndex}`;
        const message = {
          __type: 'yzb_ipc_node_message',
          identity: messageIdentityString,
          data: {
            topic,
            data: body
          }
        };
        DebuggerLogger.echoMessageDeliver();
        DebuggerLogger.echoMessageTypeTitle('Recieve message from renderer');
        DebuggerLogger.echoMessageInfoTitle('message info below');
        const consoleMesssage = {
          identity: messageIdentityString,
          topic,
        };
        console.table(consoleMesssage);
        DebuggerLogger.echoMessageDataTitle('topic data below');
        console.log(body);
        DebuggerLogger.echoMessageDeliver();
        this.sendMessageToProcess(message).then((result) => {
          console.log(result);
        }).catch((error) => {
          console.error(error);
        }).finally(() => {
          console.log('finally');
        });
        return 'ok';
      })
    ]);
  }
  runExtension(extensionPath: string) {
    this.extensionProcess = fork(extensionPath);
    this.extensionProcess?.on('message', (message: any) => {
      if (message !== null && typeof message === 'object') {
        if (message.hasOwnProperty('__type')) {
          const messageType = message.__type;
          if (messageType === 'yzb_ipc_node_message') {
            // 此为ipc消息类型
            const messageIdentity = message.identity;
            const data = message.data;
            const type = message.type;
            switch (type) {
              case 'next':
                {
                  DebuggerLogger.echoMessageDeliver();
                  DebuggerLogger.echoMessageTypeTitle('Next/Then callback to renderer');
                  DebuggerLogger.echoMessageInfoTitle('message info below');
                  const consoleData = {
                    type: 'next/then',
                    identity: messageIdentity,
                  };
                  console.table(consoleData);
                  DebuggerLogger.echoMessageDataTitle('callback data below');
                  console.log(data);
                  DebuggerLogger.echoMessageDeliver();
                  if (this.nextCallbackMap.has(messageIdentity)) {
                    const callback = this.nextCallbackMap.get(messageIdentity);
                    if (!callback) {
                      this.nextCallbackMap.delete(messageIdentity);
                      return;
                    }
                    callback(data);
                    this.nextCallbackMap.delete(messageIdentity);
                  }
                }
                break;
              case 'error':
                {
                  DebuggerLogger.echoMessageDeliver();
                  DebuggerLogger.echoMessageTypeTitle('Error callback to renderer');
                  DebuggerLogger.echoMessageInfoTitle('message info below');
                  const consoleData = {
                    type: 'error',
                    identity: messageIdentity,
                  };
                  console.table(consoleData);
                  DebuggerLogger.echoMessageDataTitle('callback data below');
                  console.log(data);
                  DebuggerLogger.echoMessageDeliver();
                  if (this.errorCallbackMap.has(messageIdentity)) {
                    const callback = this.errorCallbackMap.get(messageIdentity);
                    if (!callback) {
                      this.errorCallbackMap.delete(messageIdentity);
                      return;
                    }
                    callback(data);
                    this.errorCallbackMap.delete(messageIdentity);
                  }
                }
                break;
              default:
                // 错误类型不做任何处理
                break;
            }
          } else if (messageType === 'yzb_ipc_renderer_message') {
            DebuggerLogger.echoMessageDeliver();
            DebuggerLogger.echoMessageTypeTitle('Sender topic message to renderer');
            DebuggerLogger.echoMessageInfoTitle('message info below');
            const consoleData = {
              type: 'topic message to renderer',
              topic: message.topic,
            };
            console.table(consoleData);
            DebuggerLogger.echoMessageDataTitle('topic data below');
            console.log(message.data);
            DebuggerLogger.echoMessageDeliver();
            if (this.rendererTopicMessageCallback) {
              this.rendererTopicMessageCallback(message.topic, message.data);
            }
          } else {
            DebuggerLogger.echoRendererOtherMessage(message);
            if (this.rendererOtherMessageCallback) {
              this.rendererOtherMessageCallback(message);
            }
          }
        } else {
          DebuggerLogger.echoRendererOtherMessage(message);
          if (this.rendererOtherMessageCallback) {
            this.rendererOtherMessageCallback(message);
          }
        }
      }
    });
  }
}


export const extensionDebugger = new Debugger();
