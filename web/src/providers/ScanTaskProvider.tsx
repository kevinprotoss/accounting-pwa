import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
  } from 'react';
  import type { ScanTask } from '../api/scans';
  
  type Ctx = { tasks: ScanTask[] };
  
  const ScanTaskContext = createContext<Ctx>({ tasks: [] });
  
  export function useScanTasks() {
    return useContext(ScanTaskContext);
  }
  
  export function ScanTaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<ScanTask[]>([]);
  
    useEffect(() => {
      let es: EventSource | null = null;
      let stopped = false;
  
      function connect() {
        if (stopped) return;
        es = new EventSource('/api/scans/stream');
        es.addEventListener('tasks', (e) => {
          try {
            const data = JSON.parse((e as MessageEvent).data);
            if (Array.isArray(data)) setTasks(data);
          } catch {
            /* ignore */
          }
        });
        es.onerror = () => {
          // EventSource 会自动重连，这里不需要处理
        };
      }
  
      connect();
  
      return () => {
        stopped = true;
        es?.close();
      };
    }, []);
  
    return (
      <ScanTaskContext.Provider value={{ tasks }}>
        {children}
      </ScanTaskContext.Provider>
    );
  }