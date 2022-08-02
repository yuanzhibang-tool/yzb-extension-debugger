import { ChildProcess } from 'child_process';
import { ExtensionLifecycleEventMessageTopic, ExtensionRendererMessageTopic } from '@yuanzhibang/common';

const server = require('server');
const { get, post } = server.router;
const { json } = require('server/reply');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const version = require('../package.json').version;
var WebSocket = require('ws');

/**
 * 调试器日志打印类
 */
export class DebuggerLogger {

  /**
   * 静态变量,控制打印日志,默认为true
   */
  static withLog = true;


  /**
   * 设置打印开关
   * @param [withLog] 是否打印日志,默认为true
   */
  static setWithLog(withLog: boolean = true) {
    DebuggerLogger.withLog = withLog;
  }
  /**
   * 内部方法无需关注,输出消息title
   * @param message 消息内容
   */
  static echoMessageTypeTitle(message: string) {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;31m * ${message} \u001b[0m`);
    }
  }
  /**
   * 内部方法无需关注,输出消息的信息title
   * @param message 消息内容
   */
  static echoMessageInfoTitle(message: string) {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;32m - ${message} \u001b[0m`);
    }
  }
  /**
   * 内部方法无需关注,输出消息的数据title
   * @param message 消息内容
   */
  static echoMessageDataTitle(message: string) {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;33m $ ${message} \u001b[0m`);
    }
  }
  /**
   * 内部方法无需关注,输出分割线
   */
  static echoMessageDeliver() {
    if (DebuggerLogger.withLog) {
      console.log(`\u001b[1;35m ------- *${Date()}* ------- \u001b[0m`);
    }
  }
  /**
   * 内部方法无需关注,输出非回调消息
   * @param message 消息体
   */
  static echoRendererOtherMessage(message: any) {
    if (DebuggerLogger.withLog) {
      DebuggerLogger.echoMessageDeliver();
      DebuggerLogger.echoMessageTypeTitle('Sender not callback message to renderer');
      DebuggerLogger.echoMessageDataTitle('callback data below');
      console.log(message);
    }
  }
  /**
   * 内部方法无需关注,封装console.table
   * @param data 打印数据
   */
  static table(data: any) {
    if (DebuggerLogger.withLog) {
      console.table(data);
    }
  }

  /**
   * 内部方法无需关注,封装console.log
   * @param data 打印数据
   */
  static log(data: any) {
    if (DebuggerLogger.withLog) {
      console.log(data);
    }
  }

  /**
   * 内部方法无需关注,封装console.error
   * @param data 打印数据
   */
  static error(data: any) {
    if (DebuggerLogger.withLog) {
      console.error(data);
    }
  }
}


/**
 * 拓展进程调试器主体类
 */
export class Debugger {

  /**
   * 内部变量无需关注,next/then结果回调保存map
   */
  nextCallbackMap = new Map<string, (result: any) => void>();

  /**
   * 内部变量无需关注,error错误回调保存map
   */
  errorCallbackMap = new Map<string, (error: any) => void>();

  /**
   * 内部变量无需关注,complete/finally结束回调保存map
   */
  completeCallbackMap = new Map<string, () => void>();

  /**
   * 内部变量无需关注,拓展进程的实例
   */
  extensionProcess: ChildProcess | null = null;

  /**
   * 内部变量无需关注,用来模拟消息identity的生成系数,identity为自增状态
   */
  messageIdentityIndex = 0;

  /**
   * 内部变量无需关注,模拟渲染端topic消息回调
   */
  rendererTopicMessageCallback: ((topic: string, message: any) => void) | null = null;

  /**
   * 内部变量无需关注,模拟渲染端除了topic消息以外的其他消息回调
   */
  rendererOtherMessageCallback: ((message: any) => void) | null = null;
  /**
   * 是否打开日志,默认为true
   */
  withLog = true;

  extensionPath: string | null = null;

  abortController: AbortController | null = null;

  exeName: string = "";

  socketClient: any;
  /**
   * 创建类实例
   * @param [withLog] 是否打印调试日志,默认为true
   */
  constructor(withLog: boolean = true) {
    this.withLog = withLog;
    DebuggerLogger.withLog = withLog;
  }

  setExtensionPath(path: string) {
    this.extensionPath = path;
  }
  /**
   * 设置模拟渲染端topic消息回调
   * @param callback 消息的回调
   */
  setRendererTopicMessageCallback(callback: (topic: string, message: any) => void) {
    this.rendererTopicMessageCallback = callback;
  }

  /**
   * 设置模拟渲染端除了topic消息以外的其他消息回调
   * @param callback 消息的回调
   */
  setRendererOtherMessageCallback(callback: (message: any) => void) {
    this.rendererOtherMessageCallback = callback;
  }
  /**
   * 内部方法无需关注,清空identity下的各类回调
   * @param identity 消息的identity
   */
  clearIdentityCallback(identity: string) {
    this.nextCallbackMap.delete(identity);
    this.errorCallbackMap.delete(identity);
    this.completeCallbackMap.delete(identity);
  }

  /**
   * 内部方法无需关注,向进程发送topic消息
   * @param message 消息体
   * @returns 发送消息的promise
   */
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
  /**
   * 模拟渲染进程发送topic消息,和@yuanzhibang/node中的IpcRendererWorker的send方法
   * @param topic 消息topic
   * @param topicMessage topic消息的消息体
   * @param nextCallback next/then结果回调
   * @param errorCallbck error错误回调
   * @param completeCallback 结束回调
   */
  // tslint:disable-next-line: max-line-length
  send(topic: string, topicMessage: any, nextCallback: (result: any) => void, errorCallbck: (error: any) => void, completeCallback: () => void): void {
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

  /**
   * 模拟渲染进程发送topic消息,和@yuanzhibang/renderer中的IpcRendererWorker的sendPromise方法
   * @param topic 消息topic
   * @param topicMessage topic消息的消息体
   * @returns 返回发送消息的promise
   */
  sendPromise(topic: string, topicMessage: any): Promise<any> {
    const message = this.getTopicProcessMessage(topic, topicMessage);
    return this.sendMessageToProcess(message);
  }

  /**
   * 模拟渲染进程发送用户退出消息,用以模拟@yuanzhibang/renderer 中 worker的exit方法
   * @param message 发送的用户退出消息,可以为null
   * @returns 返回发送消息的promise
   */
  sendUserExit(message: any = null): Promise<any> {
    return this.sendPromise(ExtensionRendererMessageTopic.USER_EXIT, message);
  }

  /**
   * 模拟渲染进程发送用户退出消息,用以模拟@yuanzhibang/renderer 中 worker的getProperty方法
   * @param message 发送的获取属性消息,可以为null
   * @returns 返回发送消息的promise
   */
  sendGetProperty(message: any = null): Promise<any> {
    return this.sendPromise(ExtensionRendererMessageTopic.GET_PROPERTY, message);
  }

  /**
   * 内部方法无需关注,获取topic消息消息体
   * @param topic 消息topic
   * @param topicMessage topic消息的消息体
   * @returns 返回消息体
   */
  getTopicProcessMessage(topic: string, topicMessage: any): any {
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

  /**
   * 启动ws调试服务器,用以renderer联合调试
   * @param [port] 启动的ws端口号默认使用8889
   */
  startWsServer(port: number = 8889): void {
    const wsServer = new WebSocket.Server({ host: '0.0.0.0', port }, () => {
      DebuggerLogger.log('debug ws server started');
    });
    wsServer.on('connection', (client) => {
      this.socketClient = client;
      DebuggerLogger.log('renderer debugger connected!');
      client.on('message', (msg) => {
        const messageString = msg.toString('utf8');
        const message = JSON.parse(messageString);
        switch (message.nativeName) {
          case "run":
            this.checkExtensionIsRunning(message.identity);
            // 先发送回调消息
            this.wsSendToRenderer(message.identity, 'next', null);
            // 运行
            this.runExtension(null, message.data);
            break;
          case "stop":
            // 停止
            this.wsSendToRenderer(message.identity, 'next', null);
            if (!this.isExtensionRunning()) {
              return;
            }
            try {
              this.abortController?.abort();
            } catch (error) {
            }
            break;
          case "getProcessInfo":
            const processInfo = {};
            if (this.isExtensionRunning()) {
              processInfo[this.exeName] = {
                is_running: true
              };
            }
            this.wsSendToRenderer(message.identity, 'next', processInfo);
            break;
          case "sendProcessMessage":
            this.sendPromise(message.data.message.topic, message.data.message.message).then((data) => {
              this.wsSendToRenderer(message.identity, 'next', data);
            }
            ).catch((error) => {
              this.wsSendToRenderer(message.identity, 'error', error);
            });
            break;
          default:
            break;
        }
      });
    });
  }

  /**
   * 内部方法无需关注,返回拓展是否在运行
   * @returns  boolean 是否运行
   */
  isExtensionRunning(): boolean {
    if (!this.extensionProcess) {
      return false;
    }
    const isRunning = this.extensionProcess && this.extensionProcess.exitCode === null && !this.extensionProcess.killed;
    return isRunning;
  }

  /**
   * 内部方法无需关注,检测同名process是否运行,运行中则返回错误
   * @param identity 对应的调用识别
   */
  checkExtensionIsRunning(identity: string) {
    if (this.isExtensionRunning()) {
      this.wsSendToRenderer(identity, 'error', {
        code: '500001',
        message: 'process with the name is running',
        suggestion: 'plase check the process name or stop the process',
      });
    }
  }

  /**
   * 内部方法无需关注,检测同名process是否运行,未运行则返回错误
   * @param identity 对应的调用识别
   */
  checkExtensionIsNotRunning(identity: string) {
    if (!this.isExtensionRunning()) {
      this.wsSendToRenderer(identity, 'error', {
        code: '500002',
        message: 'process with the name is not running',
        suggestion: 'plase check the process is running',
      });
    }
  }

  /**
   * 内部方法无需关注,发送调试消息到拓展进程
   * @param identity 对应的调用识别
   * @param type 消息类型
   * @param result 输出结果
   */
  wsSendToRenderer(identity: string, type: 'next' | 'error' | 'cancel', result: any) {
    const message = {
      identity,
      type,
      result
    };
    const messageString = JSON.stringify(message);
    try {
      this.socketClient.send(messageString);
    } catch (error) {
    }
  }

  /**
   * 内部方法无需关注,发送topic消息到拓展进程
   * @param topic 对应的消息主题
   * @param message  对应的消息体
   */
  wsSendRendererTopicMessage(topic: string, message: any) {
    this.wsSendRendererMessage('yzb_ipc_renderer_message', {
      topic,
      message
    });
  }

  /**
   * 内部方法无需关注,向渲染进程发送消息
   * @param type 消息类型
   * @param data 消息体
   */
  wsSendRendererMessage(type: string, data: any) {
    const callbackInfo = {
      name: this.exeName,
      type,
      data
    };
    const messageString = JSON.stringify(callbackInfo);
    try {
      this.socketClient.send(messageString);
    } catch (error) {
    }
  }

  /**
   * 启动调试服务器
   * @param [port] 启动调试服务器的端口号
   * @param [htmlPath] 无需关注,开发本项目使用,用来调试的html网页
   */
  startServer(port: number = 8888, htmlPath: string | null = null): void {
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
        let viewPath = path.resolve(__dirname, '../view/debug.html');
        if (htmlPath) {
          if (htmlPath.startsWith('/')) {
            // !此为绝对路径,仅支持linux和darwin平台,win平台暂不支持
            viewPath = htmlPath;
          } else {
            viewPath = path.resolve(__dirname, htmlPath);
          }
        }
        let content = fs.readFileSync(viewPath, 'utf8');
        content = content.replace('$version$', version);
        ctx.res.setHeader('Content-Type', 'text/html');
        return content;
      }),
      post('/*', async ctx => {
        const url = ctx.url;
        const body = ctx.body;
        const topic = url.slice(1);
        const message = this.getTopicProcessMessage(topic, body);
        try {
          const result = await this.sendMessageToProcess(message);
          DebuggerLogger.log(result);
          const resultData = {
            type: 'next/then',
            data: result
          };
          return json(resultData);
        } catch (error) {
          DebuggerLogger.error(error);
          const errorData = {
            type: 'error',
            data: error
          };
          return json(errorData);
        }
      })
    ]);
  }
  /**
   * 根据js或者ts路径运行拓展进程
   * @param extensionPath js或者ts的入口文件地址,null为了便于进行单元测试
   */
  runExtension(extensionPath: string | null = null, extensionParams: any = {}): void {
    this.exeName = extensionParams['name'];
    if (extensionPath) {
      this.extensionPath = extensionPath;
    };
    let args = extensionParams.args;
    let passEnv: any = extensionParams.env;
    if (!args) {
      args = [];
    }
    if (!passEnv) {
      passEnv = {};
    }
    const appDir = "./";
    passEnv.HOME = appDir;
    // 设置app_id和app_dir目录
    passEnv.APP_ID = extensionParams.app_id;
    passEnv.APP_DIR = appDir;
    const env = { ...process.env, ...passEnv };

    let timeout = null;
    if (extensionParams.timeout) {
      timeout = extensionParams.timeout;
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.wsSendRendererTopicMessage(ExtensionLifecycleEventMessageTopic.ON_START, null);

    if (this.extensionPath) {
      // 支持ts,判断后缀
      if (this.extensionPath.endsWith('.ts')) {
        args.push('-r');
        args.push('ts-node/register');
        this.extensionProcess = fork(this.extensionPath, args, {
          env,
          signal,
          timeout: timeout,
          stdio: 'pipe',
          cwd: appDir,
        });
      } else {
        this.extensionProcess = fork(this.extensionPath, args, {
          env,
          signal,
          timeout: timeout,
          stdio: 'pipe',
          cwd: appDir,
        });
      }
    }
    this.extensionProcess?.stderr?.on('data', (data: Buffer) => {
      if (typeof data === 'string') {
        data = Buffer.from(data, 'utf-8');
      }
      const bufferArray = data.toJSON().data;
      this.wsSendRendererTopicMessage(ExtensionLifecycleEventMessageTopic.ON_STDERR, bufferArray);
    });

    this.extensionProcess?.stdout?.on('data', (data: Buffer) => {
      // !发给前端是二进制的array
      if (typeof data === 'string') {
        data = Buffer.from(data, 'utf-8');
      }
      const bufferArray = data.toJSON().data;
      this.wsSendRendererTopicMessage(ExtensionLifecycleEventMessageTopic.ON_STDOUT, bufferArray);
    });

    this.extensionProcess?.on('close', (code) => {
      this.wsSendRendererTopicMessage(ExtensionLifecycleEventMessageTopic.ON_CLOSE, code);
    });
    this.extensionProcess?.on('exit', (code) => {
      this.wsSendRendererTopicMessage(ExtensionLifecycleEventMessageTopic.ON_EXIT, code);
    });
    this.extensionProcess?.on('error', (error) => {
      this.wsSendRendererTopicMessage(ExtensionLifecycleEventMessageTopic.ON_ERROR, error);
    });
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
            this.wsSendRendererTopicMessage(message.topic, message.message);
          } else {
            DebuggerLogger.echoRendererOtherMessage(message);
            if (this.rendererOtherMessageCallback) {
              this.rendererOtherMessageCallback(message);
            }
            this.wsSendRendererMessage('message', message);
          }
        } else {
          DebuggerLogger.echoRendererOtherMessage(message);
          if (this.rendererOtherMessageCallback) {
            this.rendererOtherMessageCallback(message);
          }
          this.wsSendRendererMessage('message', message);
        }
      }
    });
  }
}

export const extensionDebugger = new Debugger(true);
