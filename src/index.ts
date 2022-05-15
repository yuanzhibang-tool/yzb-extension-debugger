class Debugger {
  echoMessageTypeTitle(message) {
    console.log(`\u001b[1;31m * ${message}`);
  }
  echoMessageInfoTitle(message) {
    console.log(`\u001b[1;32m - ${message}`);
  }
  echoMessageDataTitle(message) {
    console.log(`\u001b[1;33m $ ${message}`);
  }

  echoMessageDeliver() {
    console.log(`\u001b[1;35m -------------------------- *${Date()}* --------------------------`);
  }
}