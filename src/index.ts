class IpcSender {
  // 用以进行回调的识别字符串
  identity: string;
  constructor(identity: string) {
    this.identity = identity;
  }
  // 结果回调
  next = (result: any = null) => {
    this.sendMessageWithType('next', result);
  };
  // 错误回调
  error = (error: any = null) => {
    this.sendMessageWithType('error', error);
  };

  sendMessageWithType(type: string, result: any) {
    const message = {
      __type: 'yzb_ipc_node_message',
      identity: this.identity,
      data: result,
      type,
    };
    if (process.send) {
      process.send(message);
    }
  }
}
class IpcNode {
  messageCallbackMap = new Map();
  onceMessageCallbackMap = new Map();
  constructor() {
    process.on('message', (messageObject: any) => {
      if (messageObject !== null && typeof messageObject === 'object') {
        if (messageObject.hasOwnProperty('__type')) {
          const messageType = messageObject.__type;
          if (messageType === 'yzb_ipc_node_message') {
            // 此为ipc消息类型
            const messageIdentity = messageObject.identity;
            const data = messageObject.data;
            const messageTopic = data.topic;
            const messageTopicData = data.data;
            // 查找对应的回调,有则执行,无则不执行
            const sender = new IpcSender(messageIdentity);
            if (this.messageCallbackMap.has(messageTopic)) {
              const callback = this.messageCallbackMap.get(messageTopic);
              callback(sender, messageTopicData);
            } else if (this.onceMessageCallbackMap.has(messageTopic)) {
              const callback = this.onceMessageCallbackMap.get(messageTopic);
              callback(sender, messageTopicData);
              // 执行完毕后,清除回调
              this.onceMessageCallbackMap.delete(messageTopic);
            } else {
              // 没有回调可执行
            }
          }
        }
      }
    });
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
  send(topic: string, data: any) {
    const message = {
      __type: 'yzb_ipc_renderer_message',
      topic,
      data,
    };
    if (process.send) {
      process.send(message);
    }
  }
}

export const ipc = new IpcNode();