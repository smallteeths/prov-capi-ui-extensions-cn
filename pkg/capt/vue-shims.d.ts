import 'vue';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'vue' {
  interface ComponentCustomProperties {
    t: (key: string, args?: Record<string, unknown>) => string;
    $store: any;
    $fetch: (deep?: boolean) => Promise<void>;
    $fetchState: { pending: boolean; error: unknown; timestamp: number };
  }
}
