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

There is also a list of past problems that are no longer active.

The "external statuspages" section are hard-coded into ```views/index.ejs``` at the moment. 

There is a compact view of the web page (link in bottom) where services are not grouped into segments, usable for public displays that need
to display more in one view.

This is a work in progress.