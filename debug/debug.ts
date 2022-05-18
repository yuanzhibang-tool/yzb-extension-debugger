import { extensionDebugger, DebuggerLogger } from '../src';
DebuggerLogger.withLog = true;
const viewPath = '';
extensionDebugger.startServer(8080, viewPath);
