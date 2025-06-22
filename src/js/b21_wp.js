class B21_WP {

    constructor(planner) {
        this.planner = planner; // reference to B21TaskPlanner instance
        this.task = planner.b21_task;
        this.DEFAULT_RADIUS_M = 500;
        this.DEFAULT_START_RADIUS_M = 2500;
        this.DEFAULT_FINISH_RADIUS_M = 2000;
        this.DEFAULT_AAT_RADIUS_M = 4000;
    }

    new_point(index, position) {
        this.name = null;
        this.position = position;
        this.icao = null;
        this.data_icao = null; // original ICAO code from source data (may not use in output PLN if not first/last waypoint)
        this.runway = null; // Selected runway
        this.runways = null; // List of available runways
        this.alt_m = 0;
        this.alt_m_updated = false; // true is elevation has been updated
        this.radius_m = null;
        this.max_alt_m = null;
        this.min_alt_m = null;
        // turnpoint sector (Leaflet circle)
        this.is_aat = false; // is this WP the center of an AREA ?

        // Values from task
        // Note each 'leg_' value is TO this waypoint
        this.index = index;
        this.aat_line = null; // holds [L.polyline, L.polyline] used in task.js to draw AAT lines for tracklog on map
        this.leg_bearing_deg = null; // Bearing from previous WP to this WP
        this.leg_distance_m = null; // Distance (meters) from previous WP to this WP
        this.marker = this.create_marker();
    }

    reset() {
    }

    isAAT(set_value) {
        if (set_value != null) {
            this.is_aat = set_value;
        }
        return this.is_aat;
    }

    create_marker() {
        let marker = L.marker(this.position, {
            icon: this.get_icon(wp),
            draggable: false, // ** Waypoints are all fixed on WeSimGlide.org **
            autoPan: true,
            bubblingMouseEvents: false
        });

        marker.bindPopup('', {
            offset: [20, 10],
            className: "wp_popup",
            autoClose: false,
            bubblingMouseEvents: false
        });

        marker.on('click', function () {
            this.wp_click(wp);
        });

        this.task.map_elements.addLayer(marker);

        return marker;
    }

    wp_click(wp) {
        this.task.select_waypoint(wp.index);
    }

    get_icon(wp) {
        let icon_str = (wp.get_name()).replaceAll(" ", "&nbsp;");
        let class_name = (wp.task.index == wp.index) ? "wp_icon_html_current" : "wp_icon_html";
        let icon_html = '<div class="' + class_name + '">' + icon_str + "</div>";
        let wp_icon = L.divIcon({
            className: "wp_icon",
            iconSize: [5, 5],
            iconAnchor: [0, 0],
            html: icon_html
        });

        return wp_icon;
    }

    is_task_start() {
        return this.index == this.task.start_index;
    }

    is_task_finish() {
        return this.index == this.task.finish_index;
    }

    get_name() {
        if (this.name == null) {
            if (this.index == 0) {
                return "Origin";
            } else {
                return "WP " + (this.index - 1);
            }
        }
        return this.name;
    }

    set_name(name) {
        this.name = name;
        this.update_icon(wp);
    }

    get_icao() {
        return this.icao == null ? "" : this.icao;
    }

    set_icao(icao) {
        if (icao == "") {
            this.icao = null;
        } else {
            this.icao = icao;
            if (this.name == null) {
                this.name = this.icao;
            }
        }
        this.update_icon(wp);
    }

    get_runway() {
        return this.runway == null ? "" : this.runway;
    }

    set_runway(runway) {
        this.runway = runway;
    }

    set_radius(radius_m) {
        this.radius_m = radius_m;
    }

    get_radius() {
        if (this.radius_m != null) return this.radius_m;
        if (this.is_task_start()) return this.DEFAULT_START_RADIUS_M;
        if (this.is_task_finish()) return this.DEFAULT_FINISH_RADIUS_M;
        return this.DEFAULT_RADIUS_M;
    }

    get_leg_bearing() {
        if (this.leg_bearing_deg == null) {
            return "";
        }
        return this.leg_bearing_deg.toFixed(0);
    }

    update(prev_wp = null) {
        if (prev_wp != null) {
            this.update_leg_distance(prev_wp);
            this.update_leg_bearing(prev_wp);
        }
    }

    update_leg_distance(prev_wp) {
        this.leg_distance_m = Geo.get_distance_m(this.position, prev_this.position);
    }

    update_leg_bearing(prev_wp) {
        this.leg_bearing_deg = Geo.get_bearing_deg(prev_this.position, this.position);
    }

    update_icon(wp) {
        let icon = wp.get_icon(wp);
        this.marker.setIcon(icon);
    }

    display_popup() {
        // Ensure the marker and position are valid before displaying the popup
        if (this.marker && this.position && this.position.lat !== undefined && this.position.lng !== undefined) {
            let content = this.generate_popup_content();
            this.marker.bindPopup(content, {
                offset: [20, 10],
                className: "wp_popup",
                autoClose: false,
                bubblingMouseEvents: false
            }).openPopup();
            this.task.current_popup = this.marker.getPopup(); // Store reference to the current popup
        } else {
            console.warn("Waypoint marker or position is not defined. Popup cannot be displayed.");
        }
    }

    generate_popup_content() {
        let firstLine = this.getFirstLine();
        let secondLine = this.getSecondLine();
        let thirdLine = this.getThirdLine();

        return `<div>${firstLine}</div><div>${secondLine}</div><div>${thirdLine}</div>`;
    }

    getFirstLine() {
        let prefix = '';
        if (this.index === 0) {
            prefix = '(D) ';
        } else if (this.index === this.task.start_index) {
            prefix = '(S) ';
        } else if (this.index === this.task.finish_index) {
            prefix = '(F) ';
        } else if (this.index === this.task.waypoints.length - 1) {
            prefix = '(A) ';
        }
        return `<strong>${prefix}${this.name || `Waypoint ${this.index + 1}`}</strong>`;
    }

    getSecondLine() {
        let secondLine = '';
        if (this.index === 0 || this.index === this.task.waypoints.length - 1) {
            secondLine = `${this.icao || 'N/A'}${this.runway ? ' Rwy ' + this.runway : ''}`;
            if (this.leg_distance_m) {
                secondLine += ` Dist: ${this.planner.tb.userSettings.distance === 'metric' ? (this.leg_distance_m / 1000).toFixed(1) + ' km' : (this.leg_distance_m * 0.000621371).toFixed(1) + ' mi'}`;
            }
        } else {
            if (this.isAAT()) {
                secondLine += 'AAT - ';
            }
            if (this.radius_m) {
                if (this.planner.tb.userSettings.distance === 'metric') {
                    secondLine += this.radius_m >= 5000 ? `Radius: ${(this.radius_m / 1000).toFixed(1)} km ` : `Radius: ${Math.round(this.radius_m)} m `;
                } else {
                    const radiusFeet = this.radius_m * 3.28084;
                    secondLine += radiusFeet >= 5280 ? `Radius: ${(radiusFeet / 5280).toFixed(1)} mi ` : `Radius: ${Math.round(radiusFeet)}' `;
                }
            }
            if (this.min_alt_m) {
                secondLine += this.planner.tb.userSettings.altitude === 'imperial' ? `MIN: ${Math.round(this.min_alt_m * 3.28084)}' ` : `MIN: ${Math.round(this.min_alt_m)} m `;
            }
            if (this.max_alt_m) {
                secondLine += this.planner.tb.userSettings.altitude === 'imperial' ? `MAX: ${Math.round(this.max_alt_m * 3.28084)}' ` : `MAX: ${Math.round(this.max_alt_m)} m `;
            }
            if (this.leg_distance_m) {
                secondLine += this.planner.tb.userSettings.distance === 'metric' ? ` Dist: ${(this.leg_distance_m / 1000).toFixed(1)} km` : ` Dist: ${(this.leg_distance_m * 0.000621371).toFixed(1)} mi`;
            }
        }
        return secondLine;
    }

    getThirdLine() {
        return this.planner.tb.userSettings.altitude === 'imperial'
            ? `Lat: ${this.position.lat.toFixed(6)} Long: ${this.position.lng.toFixed(6)} Elev: ${Math.round(this.alt_m * 3.28084)}'`
            : `Lat: ${this.position.lat.toFixed(6)} Long: ${this.position.lng.toFixed(6)} Elev: ${Math.round(this.alt_m)} m`;
    }

    is_start(p1, p2, leg_bearing_deg) {
        if (this.max_alt_m != null && p1.alt_m > this.max_alt_m) {
            return false;
        }
        if (this.min_alt_m != null && p1.alt_m < this.min_alt_m) {
            return false;
        }

        let radius_m = this.radius_m == null ? this.DEFAULT_START_RADIUS_M : this.radius_m;
        let p1_distance_m = Geo.get_distance_m(p1, this.position);
        if (p1_distance_m > radius_m) {
            return false;
        }
        let wp_bearing_deg = Geo.get_bearing_deg(p1, this.position);
        let in_sector = Geo.in_sector(leg_bearing_deg, wp_bearing_deg, 180);
        if (!in_sector) {
            return false;
        }

        let reverse_bearing_deg = (leg_bearing_deg + 180) % 360;
        wp_bearing_deg = Geo.get_bearing_deg(p2, this.position);
        let over_start_line = Geo.in_sector(reverse_bearing_deg, wp_bearing_deg, 180);
        return over_start_line;
    }

    is_finish(p1, p2) {
        let wp_bearing_deg = Geo.get_bearing_deg(p1, this.position);
        let before_finish_line = Geo.in_sector(this.leg_bearing_deg, wp_bearing_deg, 180);
        if (!before_finish_line) {
            return false;
        }

        if (this.max_alt_m != null && p2.alt_m > this.max_alt_m) {
            return false;
        }
        if (this.min_alt_m != null && p2.alt_m < this.min_alt_m) {
            return false;
        }

        let radius_m = this.radius_m == null ? this.DEFAULT_FINISH_RADIUS_M : this.radius_m;
        let distance_m = Geo.get_distance_m(p2, this.position);
        if (distance_m > radius_m) {
            return false;
        }

        let reverse_bearing_deg = (this.leg_bearing_deg + 180) % 360;
        wp_bearing_deg = Geo.get_bearing_deg(p2, this.position);
        let p2_in_sector = Geo.in_sector(reverse_bearing_deg, wp_bearing_deg, 180);
        return p2_in_sector;
    }

    is_wp(p1, p2) {
        if (!this.in_sector(p1) && this.in_sector(p2)) {
            return true;
        }
        return false;
    }

    is_wp_exit(p1, p2) {
        if (this.in_sector(p1) && !this.in_sector(p2)) {
            return true;
        }
        return false;
    }

    toString() {
        return this.name;
    }
}