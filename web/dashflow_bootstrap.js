/* eslint-env browser */
/* global React, ReactDOM, Utils, Components, Dashboards, io, jsyaml */
(function bootstrap() {
  const notifyThrottle = Utils.throttleFactory(500);

  const appStore = {
    dashboards: [],
    dashboardsYAML: null,
    currentDashboardTitle: null,
    globalFilter: "",
    events: [],
    errorMessages: [],
    subscribers: [],
    subscribe: function subscribe(subscriber) {
      this.subscribers.push(subscriber);
    },
    notifySubscribers: function notifySubscribersWithThrottle(
      realtime = false
    ) {
      const self = this;

      if (realtime) {
        self.subscribers.forEach(subscriber => subscriber());
      } else {
        notifyThrottle(function notifySubscribers() {
          self.subscribers.forEach(subscriber => subscriber());
        });
      }
    },
    appendEvent: function appendEvent(event) {
      this.appendEvents([event]);
    },
    appendEvents: function appendEvents(evts) {
      this.events = this.events.concat(evts);
      this.notifySubscribers();
    },
    resetEvents: function resetEvents() {
      this.events = [];
      this.notifySubscribers();
    },
    updateDashboards: function updateDashboards(
      dashboards,
      dashboardsYAML = null
    ) {
      this.dashboardsYAML =
        dashboardsYAML || jsyaml.safeDump(dashboards, { flowLevel: 2 });
      this.dashboards = Dashboards.parseDashboards(dashboards).concat([
        Dashboards.SystemDashboard,
      ]);

      this.notifySubscribers(true);
    },
    updateGlobalFilter: function updateGlobalFilter(filter) {
      this.globalFilter = filter;

      this.notifySubscribers(true);
    },
    updateCurrentDashboardTitle: function updateCurrentDashboardTitle(title) {
      this.currentDashboardTitle = title;

      this.notifySubscribers(true);
    },
    updateDashboardsYAML: function updateDashboardsYAML(dashboardsYAML) {
      try {
        const config = jsyaml.safeLoad(dashboardsYAML);

        this.updateDashboards(config, dashboardsYAML);
      } catch (err) {
        this.dashboardsYAML = dashboardsYAML;

        this.notifySubscribers(true);
      }
    },
    addErrorMessage: function addErrorMessage(message) {
      this.errorMessages.push(message);

      this.notifySubscribers(true);
    },
    clearErrorMessages: function clearErrorMessages() {
      this.errorMessages = [];

      this.notifySubscribers(true);
    },
  };

  function createSocket(store) {
    const socket = io();

    function init() {
      socket.emit("get_dashboards_config");

      socket.emit("catchup");
    }

    socket.on("get_dashboards_config", function(dashboards) {
      try {
        store.clearErrorMessages();
        store.updateDashboards(dashboards);
        store.updateCurrentDashboardTitle(null);
      } catch (err) {
        store.addErrorMessage(err.message);
      }
    });

    socket.on("catchup_batch", function(messages) {
      store.appendEvents(messages);
    });

    socket.on("catchup_done", function() {
      socket.emit("delta");
    });

    socket.on("delta", function(message) {
      store.appendEvent(message);
    });

    socket.on("reconnect", function() {
      store.resetEvents();
      init();
    });

    init();

    return socket;
  }

  createSocket(appStore);

  ReactDOM.render(
    React.createElement(Components.App, { store: appStore }),
    document.getElementById("app")
  );
})();
