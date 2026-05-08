export const network = $state({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
});

if (typeof window !== 'undefined') {
  window.addEventListener('online',  () => { network.online = true;  });
  window.addEventListener('offline', () => { network.online = false; });
}
