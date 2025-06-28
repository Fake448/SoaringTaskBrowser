"use strict"

// ******************************************************************************
// ***********   Task class                **************************************
// ******************************************************************************

class B21_Task {
    constructor(planner) {
        this.planner = planner; // Reference to parent app
        this.init();
    }

    init() {
        this.entrySeqID = this.planner.currentEntrySeqID;
        this.name = null;           // From filename
        this.title = null;          // From MSFS PLN
        this.description = null;    // From MSFS PLN
        this.waypoints = [];        // Ordered list of waypoints
        this.index = null;          // Index of current waypoint
        this.start_index = null;    // Index of start waypoint
        this.finish_index = null;   // Index of finish waypoint
        this.start_index_set = null;    // Will be set to TRUE if user has assigned start wp
        this.finish_index_set = null;   // Will be set to TRUE if user has assigned finish wp
        this.is_nb21 = false;        // Task loaded from NB21 Logger
        this.is_local = false;        // Task loaded DIRECTLY from NB21 Logger
        this.task_distance_m = 123456;
        this.aat_min_time_s = null; // minimum time for an AAT task in seconds

        this.map_elements = L.layerGroup();

        // task bounds
        this.min_lat = 90;
        this.min_lng = 180;
        this.max_lat = -90;
        this.max_lng = -180;
    }

    // Return true if a task is actually available
    available() {
        return this.waypoints.length > 0;
    }

    // isAAT returns true if this task has an AAT waypoint
    isAAT() {
        for (let wp_index = 1; wp_index < this.waypoints.length; wp_index++) {
            if (this.waypoints[wp_index].isAAT()) {
                return true;
            }
        }
        return false;
    }

    // Initialize this task using a MSFS Flight Plan
    load_pln_str(pln_str, name) {
        console.log(">>>>>>task.load_pln_str", name);
        this.name = name.slice(0, name.lastIndexOf('.'));
        let msfs_pln = new B21_MSFS_PLN(this);
        // Have msfs_pln update this task
        msfs_pln.load_pln_str(pln_str);
        // Fix up the start and finish waypoints if the PLN didn't mark those.
        console.log(">>>>>>>loaded PLN, start_index=", this.start_index);
        this.fix_start_finish();
        //task.update_display();
        this.update_bounds();
    }

    fix_start_finish() {
        if (this.start_index == null && this.waypoints.length > 0) {
            this.start_index = 0;
        }
        if (this.finish_index == null && this.waypoints.length > 1) {
            this.finish_index = this.waypoints.length - 1;
        }
    }

    current_wp() {
        return this.waypoints[this.index];
    }

    get_task_distance_m() {
        let start_index = (this.start_index != null) ? this.start_index : 0;
        let finish_index = (this.finish_index != null && this.finish_index < this.waypoints.length)
            ? this.finish_index
            : this.waypoints.length - 1;
        let distance_m = 0;
        for (let i = start_index + 1; i <= finish_index; i++) {
            distance_m += this.waypoints[i].leg_distance_m;
        }
        return distance_m;
    }

    is_msfs_airport(type) {
        return type != null && type.includes("msfs") && type.includes("airport")
    }

    update_display() {
        console.log("B21_Task.update_display()");
        this.update_bounds();
        console.log(`B21_Task.update_display bounds min_lat:${this.min_lat}`);
        this.update_waypoints();
        this.update_waypoint_icons();
        this.draw();
    }

    // Parse soaring-encoded WP name, e.g.
    // *Mifflin+813|6000/1000x500 => Mifflin elevation=813ft, max_alt=6000ft, min_alt=1000ft, radius=500m
    // The "x" (radius) must come after either "+" or "|", so +813x500 is ok.
    decode_wp_name(wp) {
        //console.log("decoding", wp.index, wp.name);
        if (wp.name == null) {
            return;
        }
        // Handle START/FINISH
        if (wp.name.toLowerCase().startsWith("start")) {
            this.start_index = wp.index;
        } else if (wp.name.toLowerCase().startsWith("finish")) {
            this.finish_index = wp.index;
        } else if (wp.name.startsWith("*")) {
            if (this.start_index == null) {
                //console.log("Setting " + wp.name + " as START");
                this.start_index_set = true; // Confirm USER has explicitly set start WP
                this.start_index = wp.index;
            } else {
                //console.log("Setting " + wp.name + " as FINISH");
                this.finish_index_set = true; // Confirm USER has explicitly set finish WP
                this.finish_index = wp.index;
            }
            wp.name = wp.name.slice(1);
        }

        // Handle WP ELEVATION
        let wp_extra = "";
        let wp_plus = wp.name.split('+');
        if (wp_plus.length > 1) {
            wp_extra = wp_plus[wp_plus.length - 1];
            let alt_feet = parseFloat(wp_extra);
            if (!isNaN(alt_feet)) {
                wp.alt_m = alt_feet / this.planner.M_TO_FEET;
                wp.alt_m_updated = true;
            }
        }
        let wp_bar = wp.name.split("|");
        if (wp_bar.length > 1) {
            wp_extra = wp_bar[wp_bar.length - 1];
            let max_alt_feet = parseFloat(wp_extra);
            console.log("parsed max_alt_feet from", wp_extra);
            if (!isNaN(max_alt_feet)) {
                console.log("parse max_alt_feet", max_alt_feet);
                wp.max_alt_m = max_alt_feet / this.planner.M_TO_FEET;
            }
        }
        let wp_slash = wp_extra.split("/");
        if (wp_slash.length > 1) {
            let min_alt_feet = parseFloat(wp_slash[wp_slash.length - 1]);
            if (!isNaN(min_alt_feet)) {
                console.log("parse min_alt_feet", min_alt_feet);
                wp.min_alt_m = min_alt_feet / this.planner.M_TO_FEET;
            }
        }
        // Only look for an "x" in the
        //console.log("wp_extra is", wp_extra);
        let wp_x = wp_extra.split("x");
        if (wp_x.length > 1) {
            let wp_width_m = parseFloat(wp_x[wp_x.length - 1]);
            if (!isNaN(wp_width_m)) {
                let wp_radius_m = wp_width_m / 2;
                //console.log("parse wp_radius_m", wp_radius_m);
                wp.radius_m = wp_radius_m;
            }
        }

        // Set isAAT value for the WP if this wp is an AREA
        wp.isAAT(
            wp_extra.includes(";AAT;") ||
            (wp_extra.includes(";AAT") && wp.index != this.start_index)
        );

        // Set AAT task.aat_min_time_s if it's encoded onto the start WP
        if (wp.index == this.start_index && wp_extra.includes(";AAT")) {
            console.log("Task.decode_wp_name() AAT info on Start");
            let pos = wp_extra.indexOf(";AAT");
            let aat_info = wp_extra.slice(pos, pos + 10);
            if (aat_info.slice(6, 7) == ":" && aat_info.slice(9, 10) == ";") {
                this.aat_min_time_s = B21_Utils.hh_mm_to_time_s(aat_info.slice(4, 9));
            }
        }

        // Trim wp.name to shortest before "+" or "|"
        wp.name = wp.name.split("+")[0].split("|")[0];
    }

    // Return WP name with appended soaring parameters e.g. *Mifflin+813|5000-1000x1000
    // *=start/finish, +=elevation(feet), |=max_alt(feet), -=min_alt(feet), x=radius(meters)
    get_encoded_name(wp) {
        let start = "";
        if (wp.index == this.start_index || wp.index == this.finish_index) {
            start = "*";
        }
        let encoded_name = start + wp.get_name();
        let extra = false; // 'extra' flags that a "|" has already been added to mark the extended info
        if (wp.alt_m_updated && wp.icao == null) {
            extra = true;
            encoded_name += "+" + (wp.alt_m * this.planner.M_TO_FEET).toFixed(0);
        }
        if (wp.max_alt_m != null) {
            extra = true;
            encoded_name += "|" + (wp.max_alt_m * this.planner.M_TO_FEET).toFixed(0);
        }
        if (wp.min_alt_m != null) {
            if (!extra) {
                encoded_name += "|";
                extra = true;
            }
            encoded_name += "/" + (wp.min_alt_m * this.planner.M_TO_FEET).toFixed(0);
        }
        if (wp.radius_m != null) {
            if (!extra) {
                encoded_name += "|";
                extra = true;
            }
            encoded_name += "x" + (wp.radius_m * 2).toFixed(0);
        }
        if (wp.isAAT()) {
            if (!extra) {
                encoded_name += "|";
                extra = true;
            }
            encoded_name += ";AAT;";
        }
        if (wp.index == this.start_index && this.isAAT() && this.aat_min_time_s != null) {
            let min_time_hh_mm = B21_Utils.hh_mm_from_ts_delta(this.aat_min_time_s);
            if (min_time_hh_mm != null) {
                encoded_name += ";AAT" + min_time_hh_mm + ";";
            }
        }
        return encoded_name;
    }

    update_waypoints() {
        for (let i = 0; i < this.waypoints.length; i++) {
            const wp = this.waypoints[i];
            wp.index = i;
            if (i > 0) {
                const prev_wp = this.waypoints[i - 1];
                wp.update(prev_wp);
            }
        }
    }

    update_waypoint_icons() {
        this.waypoints.forEach(wp => wp.update_icon());
    }

    update_elevations() {
        for (let i = 0; i < this.waypoints.length; i++) {
            let wp = this.waypoints[i];
            if (wp.data_icao == null) { // Only request elevations for non-airports
                this.planner.request_alt_m(
                    wp, wp.position,
                    wp.request_alt_m_ok,
                    wp.request_alt_m_fail
                );
            }
        }
    }

    // Calculate the SW & NE corners of the task, so map can be zoomed to fit.
    update_bounds() {
        // task bounds
        this.min_lat = 90;
        this.min_lng = 180;
        this.max_lat = -90;
        this.max_lng = -180;
        for (let i = 0; i < this.waypoints.length; i++) {
            let position = this.waypoints[i].position;
            //console.log("update_bounds",i,position.lat, position.lng);
            if (position.lat < this.min_lat) {
                this.min_lat = position.lat;
            }
            if (position.lat > this.max_lat) {
                this.max_lat = position.lat;
            }
            if (position.lng < this.min_lng) {
                this.min_lng = position.lng;
            }
            if (position.lng > this.max_lng) {
                this.max_lng = position.lng;
            }
        }
        console.log(
            "new map bounds ",
            this.min_lat, this.min_lng,
            this.max_lat, this.max_lng
        );
    }

    get_bounds() {
        return L.latLngBounds(
            [this.min_lat, this.min_lng],
            [this.max_lat, this.max_lng]
        );
    }

    // Add a straight line between wp1 and wp2
    // This line is multiple polylines that all should be drawn (allowing an alternate color dash if needed).
    add_line(wp1, wp2) {
        let latlngs = [wp1.position, wp2.position];
        let color1 = this.planner.settings.task_line_color_1;
        if (color1 == null || color1 == "") {
            color1 = 'red';
        }
        let color2 = this.planner.settings.task_line_color_2;
        let line1_options = { color: color1 };
        if (color2 != null && color2 != "" && color2 != "none") {
            line1_options["dashArray"] = '12 12';
            line1_options["lineCap"] = 'butt';
        }
        this.map_elements.addLayer(L.polyline(latlngs, line1_options));

        if (color2 != null && color2 != "" && color2 != "none") {
            this.map_elements.addLayer(L.polyline(latlngs, {
                color: color2,
                dashArray: '12 12',
                dashOffset: '12',
                lineCap: 'butt'
            }));
        }
    }

    remove_marker(wp) {
        if (wp.marker != null) {
            wp.marker.remove(this.planner.map);
            wp.marker = null;
        }
    }

    add_sector(wp) {
        let wp_sector;
        if (wp.index == this.start_index) {
            // Sector = START LINE
            //console.log("add_sector START", wp.radius_m);
            let radius_m = wp.radius_m == null
                ? wp.DEFAULT_START_RADIUS_M
                : wp.radius_m;
            let direction_deg = 0;
            if (wp.index < this.waypoints.length - 1) {
                direction_deg =
                    (this.waypoints[wp.index + 1].leg_bearing_deg + 180) % 360;
            }
            wp_sector = L.semiCircle(wp.position, {
                radius: radius_m,
                color: this.planner.settings.task_line_color_1,
                interactive: false
            })
                .setDirection(direction_deg, 180);
        } else if (wp.index == this.finish_index) {
            // Sector = FINISH LINE
            //console.log("add_sector FINISH", wp.radius_m);
            let radius_m = wp.radius_m == null
                ? wp.DEFAULT_FINISH_RADIUS_M
                : wp.radius_m;
            let direction_deg = 0;
            if (wp.index > 0) {
                direction_deg = wp.leg_bearing_deg;
            }
            wp_sector = L.semiCircle(wp.position, {
                radius: radius_m,
                color: this.planner.settings.task_line_color_1,
                interactive: false
            })
                .setDirection(direction_deg, 180);
        } else {
            let sector_color = wp.isAAT()
                ? "green"
                : this.planner.settings.task_line_color_1;
            // Sector = WAYPOINT
            wp_sector = L.circle(wp.position, {
                radius: wp.radius_m,
                color: sector_color,
                weight: 1,
                interactive: false
            });
        }
        this.map_elements.addLayer(wp_sector);
    }

    draw() {
        console.log("Task.draw()");
        for (let i = 0; i < this.waypoints.length; i++) {
            let wp = this.waypoints[i];
            // Set current WP marker to foreground
            if (i == this.index) {
                wp.marker.setZIndexOffset(1000);
            } else {
                wp.marker.setZIndexOffset(0);
            }
            // Draw task line
            if (i > 0) {
                this.add_line(
                    this.waypoints[i - 1],
                    this.waypoints[i]
                );
            }
            if (
                wp.radius_m != null ||
                wp.index == this.start_index ||
                wp.index == this.finish_index
            ) {
                this.add_sector(wp);
            }
        }
        this.map_elements.addTo(this.planner.map);
    }

    set_current_wp(index) {
        // Clear all existing popups
        this.clear_all_popups();

        this.index = index;
        this.update_waypoint_icons();
        let wp = this.current_wp();

        // Display the popup with relevant information
        wp.display_popup();

        // Call the selectWaypointInList function to highlight the waypoint in the list
        if (this.planner && this.planner.tb) {
            this.planner.tb.selectWaypointInList(index);
        }
    }

    select_waypoint(index) {
        // Check if the waypoint is valid and has a position
        let wp = this.waypoints[index];
        if (
            wp &&
            wp.position &&
            wp.position.lat !== undefined &&
            wp.position.lng !== undefined
        ) {
            this.set_current_wp(index);
        } else {
            console.warn(
                "Waypoint position is not defined. Cannot select waypoint."
            );
        }
    }

    reset() {
        this.planner.map.removeLayer(this.map_elements);
        this.planner.map.closePopup();
    }

    clear_all_popups() {
        for (let wp of this.waypoints) {
            if (
                wp.marker &&
                wp.marker.getPopup() &&
                wp.marker.getPopup().isOpen()
            ) {
                wp.marker.closePopup();
            }
        }
        this.current_popup = null;
    }

    // *******************************************
    // Tracklog Sector calculations
    // Using position as { "lat": , "lng", "alt_m" }
    // *******************************************

    // Return { "start": true|false, "ts": seconds timestamp of start }
    is_start(p1, p2) {
        if (this.start_index == null) {
            console.log("Task.is_start false start_index is null");
            return false;
        }
        if (this.start_index > this.waypoints.length - 2) {
            console.log("Task.is_start false no leg after start");
            return false;
        }

        let leg_bearing_deg = this.waypoints[this.start_index + 1]
            .leg_bearing_deg;
        //console.log("Task.is_start() leg_bearing_deg="+leg_bearing_deg);
        return this.waypoints[this.start_index].is_start(
            p1, p2, leg_bearing_deg
        );
    }

    // Return { "finish": true|false, "ts": seconds timestamp of finish }
    is_finish(p1, p2) {
        if (this.finish_index == null) {
            return false;
        }
        return this.waypoints[this.finish_index].is_finish(p1, p2);
    }

    // Return { "wp": true|false, "ts": seconds timestamp of wp }
    // true id p1 -> p2 ENTERS radius of wp
    is_wp(wp_index, p1, p2) {
        if (
            this.start_index == null ||
            wp_index <= this.start_index ||
            this.finish_index == null ||
            wp_index >= this.finish_index ||
            wp_index >= this.waypoints.length
        ) {
            return false;
        }
        return this.waypoints[wp_index].is_wp(p1, p2);
    }

    // Return { "wp": true|false, "ts": seconds timestamp of wp }
    // true id p1 -> p2 EXITS radius of wp
    is_wp_exit(wp_index, p1, p2) {
        if (
            this.start_index == null ||
            wp_index <= this.start_index ||
            this.finish_index == null ||
            wp_index >= this.finish_index ||
            wp_index >= this.waypoints.length
        ) {
            return false;
        }
        return this.waypoints[wp_index].is_wp_exit(p1, p2);
    }

    // *******************************************
    // General - convert class instance to string
    // *******************************************

    toString() {
        let str = "[";
        for (let i = 0; i < this.waypoints.length; i++) {
            str += (i == 0 ? "" : ",") + this.waypoints[i].toString();
        }
        str += "]";
        return str;
    }
} // end Task class
