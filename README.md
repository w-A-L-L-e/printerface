# Printerface control your printer with a raspberry pi
Printerface is something I cooked up to allow me printing to my 3d printers (reprap's) with the browser.
This allows you to control your 3D printer over the internet using your laptop, ipad, iphone, Android phone or any browser capable device.
It was made for the inexpensive Raspberry Pi (http://www.raspberrypi.org/) but it has also been reported to work with things like MK802 
(https://www.miniand.com/products/MK802%20Android%20Mini%20PC ).

The cool thing about it is that with the raspberry or or mk802 like devices is that it prints smoother than using a laptop running a bunch
of other services not needed for printing and it draws much less power. These mini pc's only consume 5-10watts instead of a laptop that uses +-80 watts...

Little video explaining the usage is on youtube:
http://youtu.be/tsMdusrO6bk

```
sudo apt-get install python-serial python-wxgtk2.8 python-pyglet
wget https://github.com/kliment/Printrun/tarball/master
mv master pronterface_src.tar.gz
tar -xzvf pronterface_src.tar.gz


cd /home/pi
apt-get install node-js git
#install npm
curl https://npmjs.org/install.sh | sh

#get printerface
cd /home/pi
git clone git://github.com/w-A-L-L-e/printerface.git

#forever keeps our printerface running even if it crashes, and creates a logfile while we're at it...
sudo npm install -g forever@0.9.2

#now actually fire it up, put this line in /etc/rc.local to have it on boot
cd /home/pi/printerface && forever start printerface.js

#I've also added another script that posts my ip in /etc/rc.local to my webserver. That way I can access it from the outside world too ;)
```


# On desktop mac or windows or linux machine.

This is when you dont have a pi yet. And just want a new interface to run your printer from your machine, or android phone or iphone etc.
Basically you run printerface on your pc. It starts a webserver and you can either connect with your browser on that machine by going to
http://localhost:8080 or you can figure out your ip adres and then even visit it from any device on same wifi network http://<your pc ip adres>:8080

Take the desktop branch and clone it.
Now run the following:
```
$ ./install.sh
$ ./start_printerface.sh
```

In your browser go to : http://localhost:8080 and enjoy controlling your 3d printer over the web ;).

