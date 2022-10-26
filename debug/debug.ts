import { extensionDebugger, DebuggerLogger } from '../src';
DebuggerLogger.withLog = true;
const viewPath = './debug.html';
extensionDebugger.setExtensionPath("./debug/extension.ts");
// Debug with http server, 使用http服务调试, 使用http服務調試
extensionDebugger.startServer(8080, viewPath);
extensionDebugger.runExtension();
// Use the ws service to debug with the rendering side, please do not use runExtension, please use @yuanzhibang/renderer mock worker and use code below
// 使用ws服务与渲染端联调,请不要使用runExtension,请使用@yuanzhibang/renderer mock worker后调用下方代码
// 使用ws服務與渲染端聯調,請不要使用runExtension,請使用@yuanzhibang/renderer mock worker後調用下方代碼
// extensionDebugger.setExtensionPath('./src/index.ts');
// extensionDebugger.startWsServer(9999);
