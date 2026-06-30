self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients && clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow("./index.html");
    }),
  );
});
