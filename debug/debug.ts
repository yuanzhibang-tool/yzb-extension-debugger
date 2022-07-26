import { extensionDebugger, DebuggerLogger } from '../src';
DebuggerLogger.withLog = true;
const viewPath = './debug.html';
extensionDebugger.startServer(8080, viewPath);
extensionDebugger.startWsServer(8889);
extensionDebugger.setExtensionPath("./debug/extension.ts");
// extensionDebugger.runExtension();