# zabbix-public-statuspage
Simple statuspage for services monitored by Zabbix.

## Setup

Copy ```.env_example``` into ```.env``` and edit Zabbix API URL and API token.

Copy ```services-template.json``` into ```services.json``` and adjust to match your Zabbix installation.

Then ```npm run start``` or ```npm run dev```.

You can also make a Docker container, see the Dockerfile and docker-compose.yaml files.

## Configuration

The file ```services.json``` contains ```zabbix_trigger_tags``` that filters triggers that only contain these tags. 
Then there are segments, at least one segment must be configured. In each segment, there are services that point to
different hostnames used in Zabbix. These hostnames can be changed in the web display by using ```zabbix_display_host```.

For each service, or host, active triggers are displayed as problems and if the tags in ```zabbix_trigger_tags``` matches.
This is for the convenience of not displaying all triggers as problems on a public webpage, for example templated triggers as 
disk usage warnings or cpu warnings for a virtual machine host.

## Notes

There is also a list of past problems that are no longer active.

The upcoming events under "Planned service" are collected with maintenance.get, limited to the host group named in
```zabbix_announcement_hostgroup```. Create that group in Zabbix and leave it empty: Zabbix requires a host group and a
period on every maintenance entry, but with no hosts in the group neither has any effect, so an announcement is only
ever text. Announcements are written as ordinary maintenance entries in that group, and ```Active since``` / ```Active till```
are what the page displays.

Because the group is what makes an announcement public, suppressing monitoring and announcing something are now
separate actions. Maintenance entries on real hosts or host groups, whether one time only or recurring, never reach
the page. Entries whose ```Active till``` has passed are dropped, and the rest are shown oldest first.

The "external statuspages" section are hard-coded into ```views/index.ejs``` at the moment. 

There is a compact view of the web page (link in bottom) where services are not grouped into segments, usable for public displays that need
to display more in one view.

There is a micro view of the web page (link in bottom) where only service names and history is visible, usable for narrow displays or mobile phones.

This is a work in progress.

## Example screenshot

![Example image](/status-example.png)
