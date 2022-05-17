const { extensionDebugger, DebuggerLogger } = require("../dist");
DebuggerLogger.withLog = true;
extensionDebugger.startServer(8080);