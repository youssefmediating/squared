import View from './view';

export default class Application<T extends View> extends squared.base.Application<T> {
    public createCache(documentRoot: HTMLElement) {
        super.createCache(documentRoot);
        if (this.processing.node) {
            const controllerHandler = (<chrome.base.Controller<T>> this.controllerHandler);
            controllerHandler.addElementList(this.processing.cache);
        }
        return false;
    }
}