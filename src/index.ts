import { ChildProcess } from 'child_process';
const server = require('server');
const { get, post } = server.router;
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

export class DebuggerLogger {
  static withLog = true;

  static setWithLog(withLog: boolean = true) {
    DebuggerLogger.withLog = withLog;
  }
  static echoMessageTypeTitle(message: string) {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;31m * ${message}`);
    }
  }
  static echoMessageInfoTitle(message: string) {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;32m - ${message}`);
    }
  }
  static echoMessageDataTitle(message: string) {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;33m $ ${message}`);
    }
  }
  static echoMessageDeliver() {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;35m ------- *${Date()}* -------`);
    }
  }
  static echoRendererOtherMessage(message: any) {
    if (DebuggerLogger.withLog) {
      DebuggerLogger.echoMessageDeliver();
      DebuggerLogger.echoMessageTypeTitle('Sender not callback message to renderer');
      DebuggerLogger.echoMessageDataTitle('callback data below');
      console.log(message);
      DebuggerLogger.echoMessageDeliver();
    }
  }
  static table(data: any) {
    if (DebuggerLogger.withLog) {
      console.table(data);
    }
  }
  static log(data: any) {
    if (DebuggerLogger.withLog) {
      console.log(data);
    }
  }
  static error(data: any) {
    if (DebuggerLogger.withLog) {
      console.error(data);
    }
  }
}

export class Debugger {
  nextCallbackMap = new Map();
  errorCallbackMap = new Map();
  completeCallbackMap = new Map();

  extensionProcess: ChildProcess | null = null;
  // 用来生成identity系数,identity为自增状态
  messageIdentityIndex = 0;
  rendererTopicMessageCallback: ((topic: string, message: any) => void) | null = null;
  rendererOtherMessageCallback: ((message: any) => void) | null = null;
  withLog = false;
  constructor(withLog: boolean = true) {
    this.withLog = withLog;
    DebuggerLogger.withLog = withLog;
  }

  setRendererTopicMessageCallback(callback: (topic: string, message: any) => void) {
    this.rendererTopicMessageCallback = callback;
  }

  setRendererOtherMessageCallback(callback: (message: any) => void) {
    this.rendererOtherMessageCallback = callback;
  }

  clearIdentityCallback(identity: string) {
    this.nextCallbackMap.delete(identity);
    this.errorCallbackMap.delete(identity);
    this.completeCallbackMap.delete(identity);
  }

  sendMessageToProcess(message: any) {
    DebuggerLogger.echoMessageDeliver();
    DebuggerLogger.echoMessageTypeTitle('Recieve message from renderer');
    DebuggerLogger.echoMessageInfoTitle('message info below');
    const consoleMesssage = {
      identity: message.identity,
      topic: message.data.topic,
    };
    DebuggerLogger.table(consoleMesssage);
    DebuggerLogger.echoMessageDataTitle('topic data below');
    DebuggerLogger.log(message.data.message);
    DebuggerLogger.echoMessageDeliver();
    return new Promise((resolve, reject): any => {
      const identity = message.identity;
      this.nextCallbackMap.set(identity, resolve);
      this.errorCallbackMap.set(identity, reject);
      this.extensionProcess?.send(message);
    });
  }

  // 模拟yzb-renderer worker send方法
  // tslint:disable-next-line: max-line-length
  send(topic: string, topicMessage: any, nextCallback: (result: any) => void, errorCallbck: (error: any) => void, completeCallback: () => void) {
    const message = this.getTopicProcessMessage(topic, topicMessage);
    this.sendMessageToProcess(message).then((result: any) => {
      if (nextCallback) {
        nextCallback(result);
      }
    }).catch((error: any) => {
      if (errorCallbck) {
        errorCallbck(error);
      }
    }).finally(() => {
      if (completeCallback) {
        completeCallback();
      }
    });
  }

  // 模拟yzb-renderer worker sendPromise方法
  sendPromise(topic: string, topicMessage: any) {
    const message = this.getTopicProcessMessage(topic, topicMessage);
    return this.sendMessageToProcess(message);
  }

  getTopicProcessMessage(topic: string, topicMessage: any) {
    this.messageIdentityIndex++;
    const messageIdentityString = `identity-${this.messageIdentityIndex}`;
    const message = {
      __type: 'yzb_ipc_node_message',
      identity: messageIdentityString,
      data: {
        topic,
        message: topicMessage
      }
    };
    return message;
  }

  startServer(port: number = 8888) {
    DebuggerLogger.echoMessageDeliver();
    DebuggerLogger.echoMessageInfoTitle('Debug server start successfully!');
    DebuggerLogger.echoMessageInfoTitle('server info below');
    const consoleData = {
      port,
      simple_debug_tool_url: `http://localhost:${port}`
    };
    DebuggerLogger.table(consoleData);
    DebuggerLogger.echoMessageDeliver();

    server({ port, security: { csrf: false } }, [
      get('/', ctx => {
        const viewPath = path.resolve(__dirname, '../view/debug.html');
        const content = fs.readFileSync(viewPath, 'utf8');
        ctx.res.setHeader('Content-Type', 'text/html');
        return content;
      }),
      post('/*', ctx => {
        const url = ctx.url;
        const body = ctx.body;
        const topic = url.slice(1);
        const message = this.getTopicProcessMessage(topic, body);
        this.sendMessageToProcess(message).then((result) => {
          DebuggerLogger.log(result);
        }).catch((error) => {
          DebuggerLogger.error(error);
        }).finally(() => {
          DebuggerLogger.log('finally');
        });
        return 'ok';
      })
    ]);
  }
  // extensionPath为null为了便于进行单元测试
  runExtension(extensionPath: string | null) {
    if (extensionPath) {
      this.extensionProcess = fork(extensionPath);
    }
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
                  DebuggerLogger.table(consoleData);
                  DebuggerLogger.echoMessageDataTitle('callback data below');
                  DebuggerLogger.log(data);
                  DebuggerLogger.echoMessageDeliver();
                  if (this.nextCallbackMap.has(messageIdentity)) {
                    const callback = this.nextCallbackMap.get(messageIdentity);
                    if (!callback) {
                      this.clearIdentityCallback(messageIdentity);
                      return;
                    }
                    callback(data);
                    this.clearIdentityCallback(messageIdentity);
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
                  DebuggerLogger.table(consoleData);
                  DebuggerLogger.echoMessageDataTitle('callback data below');
                  DebuggerLogger.log(data);
                  DebuggerLogger.echoMessageDeliver();
                  if (this.errorCallbackMap.has(messageIdentity)) {
                    const callback = this.errorCallbackMap.get(messageIdentity);
                    if (!callback) {
                      this.clearIdentityCallback(messageIdentity);
                      return;
                    }
                    callback(data);
                    this.clearIdentityCallback(messageIdentity);
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
            DebuggerLogger.table(consoleData);
            DebuggerLogger.echoMessageDataTitle('topic data below');
            DebuggerLogger.log(message.message);
            DebuggerLogger.echoMessageDeliver();
            if (this.rendererTopicMessageCallback) {
              this.rendererTopicMessageCallback(message.topic, message.message);
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


export const extensionDebugger = new Debugger(true);
