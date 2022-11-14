import { ipc } from '@yuanzhibang/node';
// 测试用的模拟extension

const willInitData = {
    type: 'willInitData'
};
ipc.sendOnWillInit(willInitData);

const onInitData = {
    type: 'onInitData'
};

ipc.sendOnInit(onInitData);

ipc.onGetProperty((sender, message) => {
    console.log(message);
    sender.next({});
});

ipc.onUserExit((sender, message) => {
    console.log(message);
    sender.next({});
    process.exit(0);
});

const willExitData = {
    type: 'willExitData'
};

ipc.on('test-topic', (sender, message) => {
    const callbackMessage = {
        type: 'callbackMessage'
    };
    sender.next(callbackMessage);
});

ipc.sendOnWillExit(willExitData);
