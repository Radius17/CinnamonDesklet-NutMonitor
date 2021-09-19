const Desklet = imports.ui.desklet;
const St = imports.gi.St; // Shell Toolkit
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

const UUID = "nutmonitor@radius17";
const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;

// Translation support
function _(str) {
	return Gettext.dgettext(UUID, str);
}

// Constructor
function MyNutMonitorDesklet(metadata, desklet_id) {
	// Translation init: If installed in user context, then switch to translations in user's home dir
	if(!DESKLET_ROOT.startsWith("/usr/share/")) {
		Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
	}

	this._init(metadata, desklet_id);
}

// Returns an instance of MyNutMonitorDesklet
function main(metadata, desklet_id) {
	return new MyNutMonitorDesklet(metadata, desklet_id);
}

MyNutMonitorDesklet.prototype = {
  __proto__: Desklet.Desklet.prototype,

  _init: function(metadata, desklet_id) {
    this.my_debug("- - - - - - - - - - - - - - - - function _init in " + UUID);

    Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

		this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);
		this.settings.bindProperty(Settings.BindingDirection.IN, "main-text-size", "main_text_size", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "main-text-color", "main_text_color", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "chrg-text-color", "chrg_text_color", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "err-text-color", "err_text_color", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "refresh-period", "refresh_period", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "ups-name", "ups_name", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "in-debug", "in_debug", this.on_setting_changed);

    this.setupUI();
  },

  setupUI: function() {
    this.my_debug("function setupUI in " + UUID);

    // main container for the desklet
    this.window = new St.Bin();
    this.main_text = new St.Label({style_class:"main-text"});
//    this.main_text.set_position(800, 600);
    this.window.add_actor(this.main_text);
    this.setContent(this.window);

		// set decoration settings
		this.refreshDecoration();

		// set initial values
		this.update();
  },

  redraw: function(device_model, battery_charge, ups_status) {
    this.my_debug("function redraw in " + UUID);

    if(ups_status=="OL"){
      ups_status = _("Online");
      this.text_color = this.main_text_color;
    } else if(ups_status=="OL CHRG"){
      ups_status = _("Charging");
      this.text_color = this.chrg_text_color;
    } else {
      this.text_color = this.err_text_color;
    }

    let main_text = _("Model") + ": " + device_model 
                  + "\n" + _("Battery charge") + ": " + battery_charge + "%" 
                  + "\n" + _("UPS status") + ": " + ups_status
    ;

    this.main_text.set_text(main_text);
    this.main_text.style = "font-size: " + this.main_text_size + "px;color: " + this.text_color + ";";
  },

  refreshDecoration: function() {
    this.my_debug("function refreshDecoration in " + UUID);
/*
		// prevent decorations?
		this.metadata["prevent-decorations"] = this.hide_decorations;
		this._updateDecoration();
*/
  },

	refreshDesklet: function() {
    this.my_debug("function refreshDesklet in " + UUID);
/*
    // What about make a clock ???
    let displayDate = new Date();
    var main_text = displayDate.toLocaleFormat("%d.%m.%Y\n%H:%M:%S");
*/
/*
			let subprocess = new Gio.Subprocess({
				argv: ['/usr/bin/upsc', this.ups_name, "battery.charge"],
				flags: Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDERR_PIPE,
			});
*/
			let subprocess = new Gio.Subprocess({
				argv: ['/usr/bin/upsc', this.ups_name],
				flags: Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDERR_PIPE,
			});
			subprocess.init(null);
			subprocess.wait_async(null, (sourceObject, res) => {
        let device_model="-";
        let battery_charge="-";
        let ups_status="-";

				let [, stdOut, stdErr] = sourceObject.communicate_utf8(null, null);
				// global.log(stdOut.trim()); // global.logError(stdErr);
				let upslines = stdOut.trim().split(/\r?\n/);
        //global.logWarning(upslines);
				if(upslines.length > 1) {
          for (var i = 0; i < upslines.length; i++) {
            let upsline = upslines[i].trim().split(':');
            if(upsline.length == 2) {
              if(upsline[0]=='battery.charge'){
                battery_charge = upsline[1].trim();
              }
              else if(upsline[0]=='ups.status'){
                ups_status = upsline[1].trim();
              }
              else if(upsline[0]=='device.model'){
                device_model = upsline[1].trim();
              }
            }
          }
				}
        // redrawing
        this.redraw(device_model, battery_charge, ups_status);
			});
  },

  update: function() {
	  this.my_debug("function update in " + UUID);
 	  this.my_debug("= = = > > > Refresh period=" + this.refresh_period); // debug

		this.refreshDesklet();
		this.timeout = Mainloop.timeout_add_seconds(this.refresh_period, Lang.bind(this, this.update));
  },

	on_setting_changed: function() {
    this.my_debug("function on_setting_changed in " + UUID);

		// update decoration settings
		this.refreshDecoration();

		// settings changed; instant refresh
		Mainloop.source_remove(this.timeout);
		this.update();
	},
	on_desklet_removed: function() {
    this.my_debug("function on_desklet_removed in " + UUID);

		Mainloop.source_remove(this.timeout);
	},
  my_debug: function(str){
    if(this.in_debug==true) global.log(str);
  }
}
