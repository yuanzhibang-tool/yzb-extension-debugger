declare const yzb: any;

class IpcRendererWorker {
  exeName: string;
  messageCallbackMap = new Map();
  onceMessageCallbackMap = new Map();

  constructor(exeName: string) {
    this.exeName = exeName;
  }
  onMessage(topic: string, message: any) {
    if (this.messageCallbackMap.has(topic)) {
      const callback = this.messageCallbackMap.get(topic);
      callback(message);
    } else if (this.onceMessageCallbackMap.has(topic)) {
      const callback = this.onceMessageCallbackMap.get(topic);
      callback(message);
    } else { }
  }
  on(topic: string, callback: () => {}) {
    if (
      this.messageCallbackMap.has(topic) ||
      this.onceMessageCallbackMap.has(topic)
    ) {
      throw new Error('you can not listen a topic twice!');
    }
    this.messageCallbackMap.set(topic, callback);
  }
  once(topic: string, callback: () => {}) {
    if (
      this.messageCallbackMap.has(topic) ||
      this.onceMessageCallbackMap.has(topic)
    ) {
      throw new Error('you can not listen a topic twice!');
    }
    this.onceMessageCallbackMap.set(topic, callback);
  }
  removeListener(topic: string) {
    this.messageCallbackMap.delete(topic);
    this.onceMessageCallbackMap.delete(topic);
  }
  send(topic: string, topicData: any, nextCallback: any, errorCallbck: any, completeCallback: any) {
    const data = {
      data: {
        process_name: this.exeName,
        message: {
          topic,
          data: topicData
        },
      },
      next: (result: any) => {
        if (nextCallback) {
          nextCallback(result);
        }
      },
      error: (error: any) => {
        if (errorCallbck) {
          errorCallbck(error);
        }
      },
      complete: () => {
        if (completeCallback) {
          completeCallback();
        }
      }
    };
    yzb.native.sendProcessMessage(data);
  }

  promiseSend(topic: string, topicData: any) {
    return new Promise((resolve, reject): any => {
      const data = {
        data: {
          process_name: this.exeName,
          message: {
            topic,
            data: topicData
          },
        },
        next: (result: any) => {
          resolve(result);
        },
        error: (error: any) => {
          reject(error);
        }
      };
      yzb.native.sendProcessMessage(data);
    });
  }
}

class IpcRenderer {
  messageWorkerMap = new Map();
  otherMessageCallback: ((message: any) => {}) | null = null;
  constructor() {
    if (typeof yzb === 'undefined') {
      throw new Error("yzb is not found, please read the document.");
    }
    const data = {
      data: {},
      next: (messageObject: any) => {
        if (messageObject !== null && typeof messageObject === 'object') {
          const exeName = messageObject.name;
          const type = messageObject.type;
          if (type === 'yzb_ipc_renderer_message') {
            // 此为ipc消息类型
            const messageData = messageObject.message;
            const messageTopic = messageData.topic;
            const messageTopicData = messageData.data;
            // 查找对应的回调,有则执行,无则不执行
            if (this.messageWorkerMap.has(exeName)) {
              const worker = this.messageWorkerMap.get(exeName);
              if (worker !== null && typeof worker === 'object') {
                worker.onMessage(messageTopic, messageTopicData);
              } else {
                this.messageWorkerMap.delete(exeName);
              }
            } else {
              // 没有回调可执行
            }
          } else {
            if (this.otherMessageCallback) {
              this.otherMessageCallback(messageObject);
            }
          }
        } else {
          if (this.otherMessageCallback) {
            this.otherMessageCallback(messageObject);
          }
        }
      },
    };
    yzb.native.setCallback(data);
  }
  getWorker(exeName: string) {
    const worker = new IpcRendererWorker(exeName);
    this.messageWorkerMap.set(exeName, worker);
    return worker;
  }
  deleteWorker(exeName: string) {
    this.messageWorkerMap.delete(exeName);
  }
  setOtherMessageCallback(callback) {
    this.otherMessageCallback = callback;
  }
}

export const ipc = new IpcRenderer();
