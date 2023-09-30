/**
 * This file exists because I can no longer handle the lack of generic typing in electrons ipcMain and ipcRenderer and as such have made wrappers to type them for me
 */

import {
  contextBridge,
  ipcMain as electronIpcMain,
  IpcMainEvent,
  ipcRenderer as electronIpcRenderer,
  IpcRendererEvent,
  BrowserWindow,
} from "electron";

let generatedIds = 0;

function makeId() {
  generatedIds++;
  const myId = generatedIds;
  generatedIds++;

  return `${Date.now()}|${myId}`;
}
export type IEventBase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in string]: (...args: any[]) => unknown;
};

export type KeysWithPromises<T extends IEventBase> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: ReturnType<T[K]> extends Promise<unknown> ? K : never;
}[keyof T];

export type KeysWithoutPromises<T extends IEventBase> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: ReturnType<T[K]> extends Promise<unknown> ? never : K;
}[keyof T];

export type EventReturnType<E extends IEventBase, T extends keyof E> = Awaited<
  ReturnType<E[T]>
>;

export type EventParams<E extends IEventBase, T extends keyof E> = Parameters<
  E[T]
>;

export type EventReturnTypeWithId<E extends IEventBase, T extends keyof E> = {
  data: EventReturnType<E, T>;
  id: string;
};

export type IpcRendererListeners<EventsFromMain extends IEventBase> = {
  on: <T extends keyof EventsFromMain>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromMain, T>
    ) => EventReturnType<EventsFromMain, T>
  ) => void;
  once: <T extends keyof EventsFromMain>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromMain, T>
    ) => EventReturnType<EventsFromMain, T>
  ) => void;
  off: <T extends keyof EventsFromMain>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromMain, T>
    ) => EventReturnType<EventsFromMain, T>
  ) => void;
  handle: <T extends keyof EventsFromMain>(
    event: T,
    handler: EventsFromMain[T]
  ) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAsync(method: (...args: any[]) => unknown) {
  return method.constructor.name === "AsyncFunction";
}

export class IpcRendererTyped<
  EventsToMain extends IEventBase,
  EventsFromMain extends IEventBase
> {
  private fromMainCallbacks: Map<
    keyof EventsFromMain,
    Map<
      (
        ...args: EventParams<EventsFromMain, keyof EventsFromMain>
      ) => EventReturnType<EventsFromMain, keyof EventsFromMain>,
      (
        event: IpcRendererEvent,
        instanceId: string,
        ...args: EventParams<EventsFromMain, keyof EventsFromMain>
      ) => void
    >
  > = new Map();

  exposeApi(name: string, api: EventsToMain) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const apiFinal: EventsToMain & IpcRendererListeners<EventsFromMain> = {
      ...api,
      on: (...args) => this.on(...args),
      once: (...args) => this.once(...args),
      off: (...args) => this.off(...args),
      handle: (...args) => this.handle(...args),
    };

    contextBridge.exposeInMainWorld(name, apiFinal);
    return apiFinal;
  }

  toMainEventChannel<T extends keyof EventsToMain>(event: T) {
    return `to-main-${event as string}`;
  }

  fromMainEventChannel<T extends keyof EventsFromMain>(event: T) {
    return `from-main-${event as string}`;
  }

  send<T extends keyof EventsToMain>(
    event: T,
    ...args: EventParams<EventsToMain, T>
  ) {
    electronIpcRenderer.send(this.toMainEventChannel(event), makeId(), ...args);
  }

  sendSync<T extends KeysWithoutPromises<EventsToMain>>(
    event: T,
    ...args: EventParams<EventsToMain, T>
  ): EventReturnType<EventsToMain, T> {
    return electronIpcRenderer.sendSync(
      this.toMainEventChannel(event),
      makeId(),
      ...args
    );
  }

  sendAsync<T extends KeysWithPromises<EventsToMain>>(
    event: T,
    ...args: EventParams<EventsToMain, T>
  ): Promise<EventReturnType<EventsToMain, T>> {
    const channel = this.toMainEventChannel(event);
    return new Promise<EventReturnType<EventsToMain, T>>((res) => {
      const instanceId = makeId();
      const callback = (
        _: IpcRendererEvent,
        result: EventReturnTypeWithId<EventsToMain, T>
      ) => {
        if (instanceId === result.id) {
          electronIpcRenderer.off(channel, callback);
          res(result.data);
        }
      };
      electronIpcRenderer.on(channel, callback);
      electronIpcRenderer.send(channel, instanceId, ...args);
    });
  }

  on<T extends keyof EventsFromMain>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromMain, T>
    ) => EventReturnType<EventsFromMain, T>
  ) {
    const channel = this.fromMainEventChannel(event);
    let callbacks = this.fromMainCallbacks.get(channel);

    if (!callbacks) {
      callbacks = new Map();

      this.fromMainCallbacks.set(channel, callbacks);
    }

    const callbackMiddleMan = (
      _: IpcRendererEvent,
      __: string,
      ...args: unknown[]
    ) => {
      callback(...(args as EventParams<EventsFromMain, T>));
    };

    callbacks.set(callback, callbackMiddleMan);

    electronIpcRenderer.on(this.fromMainEventChannel(event), callbackMiddleMan);
  }

  once<T extends keyof EventsFromMain>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromMain, T>
    ) => EventReturnType<EventsFromMain, T>
  ) {
    const channel = this.fromMainEventChannel(event);
    const callbackMiddleMan = (
      _: IpcRendererEvent,
      __: string,
      ...args: unknown[]
    ) => {
      callback(...(args as EventParams<EventsFromMain, T>));
    };

    electronIpcRenderer.once(channel, callbackMiddleMan);
  }

  off<T extends keyof EventsFromMain>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromMain, T>
    ) => EventReturnType<EventsFromMain, T>
  ) {
    const channel = this.fromMainEventChannel(event);

    const callbackToRemove = this.fromMainCallbacks.get(channel)?.get(callback);

    if (!callbackToRemove) return;

    electronIpcRenderer.off(
      channel,
      callbackToRemove as (...args: unknown[]) => void
    );
  }

  handle<T extends keyof EventsFromMain>(event: T, handler: EventsFromMain[T]) {
    const channel = this.fromMainEventChannel(event);
    electronIpcRenderer.on(channel, async (_, instanceId: string, ...args) => {
      const execArgs = args as EventParams<EventsFromMain, T>;
      const result = handler(...execArgs);

      electronIpcRenderer.send(channel, {
        id: instanceId,
        data: result instanceof Promise ? await result : result,
      });
    });
    return this;
  }
}

export class IpcMainTyped<
  EventsFromRenderer extends IEventBase,
  EventsToRenderer extends IEventBase
> {
  private fromRendererCallbacks: Map<
    keyof EventsFromRenderer,
    Map<
      (
        ...args: EventParams<EventsFromRenderer, keyof EventsFromRenderer>
      ) => EventReturnType<EventsFromRenderer, keyof EventsFromRenderer>,
      (
        event: IpcMainEvent,
        instanceId: string,
        ...args: EventParams<EventsFromRenderer, keyof EventsFromRenderer>
      ) => void
    >
  > = new Map();

  fromRendererEventChannel<T extends keyof EventsFromRenderer>(event: T) {
    return `to-main-${event as string}`;
  }

  toRendererEventChannel<T extends keyof EventsToRenderer>(event: T) {
    return `from-main-${event as string}`;
  }

  send<T extends keyof EventsToRenderer>(
    browserWindow: BrowserWindow,
    event: T,
    ...args: EventParams<EventsToRenderer, T>
  ) {
    browserWindow.webContents.send(this.toRendererEventChannel(event), ...args);
  }

  sendAsync<T extends KeysWithPromises<EventsToRenderer>>(
    browserWindow: BrowserWindow,
    event: T,
    ...args: EventParams<EventsToRenderer, T>
  ): Promise<EventReturnType<EventsToRenderer, T>> {
    const channel = this.toRendererEventChannel(event);

    return new Promise<EventReturnType<EventsToRenderer, T>>((res) => {
      const instanceId = makeId();
      const callback = (
        _: IpcMainEvent,
        result: EventReturnTypeWithId<EventsToRenderer, T>
      ) => {
        if (instanceId === result.id) {
          electronIpcMain.off(channel, callback);
          res(result.data);
        }
      };
      electronIpcMain.on(channel, callback);
      browserWindow.webContents.send(channel, instanceId, ...args);
    });
  }

  on<T extends keyof EventsFromRenderer>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromRenderer, T>
    ) => EventReturnType<EventsFromRenderer, T>
  ): this {
    if (!this.fromRendererCallbacks.has(event))
      this.fromRendererCallbacks.set(event, new Map());

    const callbackMiddleMan = (
      _: IpcMainEvent,
      __: string,
      ...args: unknown[]
    ) => {
      callback(...(args as EventParams<EventsFromRenderer, T>));
    };

    this.fromRendererCallbacks.get(event)?.set(callback, callbackMiddleMan);

    electronIpcMain.on(this.fromRendererEventChannel(event), callbackMiddleMan);

    return this;
  }

  once<T extends keyof EventsFromRenderer>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromRenderer, T>
    ) => EventReturnType<EventsFromRenderer, T>
  ): this {
    const callbackMiddleMan = (
      _: IpcMainEvent,
      __: string,
      ...args: unknown[]
    ) => {
      callback(...(args as EventParams<EventsFromRenderer, T>));
    };

    electronIpcMain.once(
      this.fromRendererEventChannel(event),
      callbackMiddleMan
    );

    return this;
  }

  off<T extends keyof EventsFromRenderer>(
    event: T,
    callback: (
      ...args: EventParams<EventsFromRenderer, T>
    ) => EventReturnType<EventsFromRenderer, T>
  ): this {
    const callbackToRemove = this.fromRendererCallbacks
      .get(this.fromRendererEventChannel(event))
      ?.get(callback);

    if (!callbackToRemove) return this;

    electronIpcMain.off(
      this.fromRendererEventChannel(event),
      callbackToRemove as (...args: unknown[]) => void
    );

    return this;
  }

  handle<T extends keyof EventsFromRenderer>(
    event: T,
    handler: EventsFromRenderer[T]
  ) {
    const channel = this.fromRendererEventChannel(event);

    electronIpcMain.on(
      channel,
      async (mainEvent, instanceId: string, ...args) => {
        const execArgs = args as EventParams<EventsFromRenderer, T>;

        const result = handler(...execArgs);

        if (result instanceof Promise) {
          mainEvent.reply(channel, {
            id: instanceId,
            data: await result,
          });
        } else {
          mainEvent.returnValue = result;
        }
      }
    );
    return this;
  }
}
