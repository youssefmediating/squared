declare global {
    namespace chrome.base {
        interface View extends squared.base.Node {
        }

        class View implements View {
            constructor(id: number, sessionId: string, element: Element);
        }
    }
}

export = chrome.base.View;