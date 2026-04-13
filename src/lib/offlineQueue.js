const QUEUE_KEY = 'offline_queue';

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToQueue(operation) {
  const queue = getQueue();
  const item = { ...operation, id: Date.now() + Math.random(), created_at: new Date().toISOString(), attempts: 0 };
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export function removeFromQueue(id) {
  const queue = getQueue().filter(item => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function getQueueCount() {
  return getQueue().length;
}