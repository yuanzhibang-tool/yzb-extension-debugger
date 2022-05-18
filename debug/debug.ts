import { extensionDebugger, DebuggerLogger } from '../src';
DebuggerLogger.withLog = true;
const viewPath = './debug.html';
extensionDebugger.startServer(8080, viewPath);
