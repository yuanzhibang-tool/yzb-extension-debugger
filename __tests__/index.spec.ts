import { } from 'jest';
import { DebuggerLogger, Debugger } from '../src/index';

class MockProcess {
    message: any;
    send(message: any) {
        this.message = message;
    }
}

describe('DebuggerLogger check', () => {
    test('check set withLog', () => {
        expect(DebuggerLogger.withLog).toEqual(true);
        DebuggerLogger.setWithLog(false);
        expect(DebuggerLogger.withLog).toEqual(false);
        DebuggerLogger.setWithLog(true);
        expect(DebuggerLogger.withLog).toEqual(true);
    });
});


describe('Debugger check', () => {
    test('check constructor', () => {
        const dg = new Debugger();
        expect(dg.withLog).toEqual(true);
        expect(DebuggerLogger.withLog).toEqual(true);
        const dg1 = new Debugger(false);
        expect(dg1.withLog).toEqual(false);
        expect(DebuggerLogger.withLog).toEqual(false);
        const dg2 = new Debugger(true);
        expect(dg2.withLog).toEqual(true);
        expect(DebuggerLogger.withLog).toEqual(true);
    });

    test('check setRendererTopicMessageCallback', () => {
        const dg = new Debugger();
        const callback = (topic: string, message: any) => { };
        dg.setRendererTopicMessageCallback(callback);
        expect(dg.rendererTopicMessageCallback).toEqual(callback);

    });

    test('check setRendererOtherMessageCallback', () => {
        const dg = new Debugger();
        const callback = (message: any) => { };
        dg.setRendererOtherMessageCallback(callback);
        expect(dg.rendererOtherMessageCallback).toEqual(callback);

    });

    test('check sendMessageToProcess', () => {
        expect.assertions(6);
        const dg = new Debugger();
        dg.extensionProcess = new MockProcess() as any;
        const identity = '123456';
        const testMessage = {
            identity,
            data: { k1: 'v1' }
        };
        const testResultData = { r1: 'v1' };
        const testErrorData = { e1: 'v1' };
        dg.sendMessageToProcess(testMessage)
            .then((result: any) => {
                expect(result).toEqual(testResultData);
            })
            .catch((error: any) => { })
            .finally(() => {
                expect(true).toEqual(true);
            });
        dg.nextCallbackMap.get(identity)(testResultData);
        expect((dg.extensionProcess as any).message).toEqual(testMessage);
        dg.sendMessageToProcess(testMessage)
            .then((result: any) => {
            })
            .catch((error: any) => {
                expect(error).toEqual(testErrorData);
            })
            .finally(() => {
                expect(true).toEqual(true);
            });
        dg.errorCallbackMap.get(identity)(testErrorData);
        expect((dg.extensionProcess as any).message).toEqual(testMessage);
    });

    test('check getTopicProcessMessage', () => {
        const dg = new Debugger();
        const testTopic = 'test-topic';
        const topicMessage = { t1: 'v1' };
        const messageIdentityIndex = dg.messageIdentityIndex + 1;
        const messageIdentityString = `identity-${messageIdentityIndex}`;
        const topicProcessMessage = dg.getTopicProcessMessage(testTopic, topicMessage);
        const message = {
            __type: 'yzb_ipc_node_message',
            identity: messageIdentityString,
            data: {
                topic: testTopic,
                message: topicMessage
            }
        };
        expect(topicProcessMessage).toEqual(message);
    });

    test('check send', () => {
        const nextCallback = (result: any) => { };
        const errorCallback = (error: any) => { };
        const completeCallback = () => { };
        const testTopic = 'test-topic';
        const exeName = 'test-exe-name';
        const testTopicMessage = { k1: 'v1' };

        const data = {
            data: {
                process_name: exeName,
                message: {
                    topic: testTopic,
                    data: testTopicMessage
                },
            },
            next: nextCallback,
            error: errorCallback,
            complete: completeCallback
        };
        const instance = new Debugger();
        instance.send(testTopic, testTopicMessage, nextCallback, errorCallback, completeCallback);
        const identity = instance.nextCallbackMap.keys().next().value;
        expect(instance.nextCallbackMap.get(identity)).toEqual(nextCallback);
        expect(instance.errorCallbackMap.get(identity)).toEqual(errorCallback);
    });

    test('check sendPromise', () => {
        expect.assertions(4);
        const testTopic = 'test-topic';
        const exeName = 'test-exe-name';
        const testTopicMessage = { k1: 'v1' };
        const testResultData = { r1: 'v1' };
        const testErrorData = { e1: 'v1' };
        const nextCallback = (result: any) => {
            expect(result).toEqual(testResultData);
        };
        const errorCallback = (error: any) => {
            expect(error).toEqual(testErrorData);
        };
        const completeCallback = () => {
            expect(true).toEqual(true);
        };
        const data = {
            data: {
                process_name: exeName,
                message: {
                    topic: testTopic,
                    data: testTopicMessage
                },
            }
        };
        const instance = new Debugger();
        instance.sendPromise(testTopic, testTopicMessage).then(nextCallback).catch(errorCallback).finally(completeCallback);
        const identity = instance.nextCallbackMap.keys().next().value;
        instance.nextCallbackMap.get(identity)(testResultData);
        instance.sendPromise(testTopic, testTopicMessage).then(nextCallback).catch(errorCallback).finally(completeCallback);
        instance.errorCallbackMap.get(identity)(testResultData);
    });

});