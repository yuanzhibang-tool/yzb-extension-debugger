import { extensionDebugger, DebuggerLogger } from '../src';
DebuggerLogger.withLog = true;
const viewPath = './debug.html';
extensionDebugger.setExtensionPath("./debug/extension.ts");
// !使用http服务调试
extensionDebugger.startServer(8080, viewPath);
extensionDebugger.runExtension();
// !使用ws服务与渲染端联调,请不要使用runExtension,请使用@yuanzhibang/renderer mock worker后调用run执行
extensionDebugger.startWsServer(8889);
