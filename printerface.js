// ============================= Printerface ===================================
// Author       : Walter Schreppers
// Description  : Web interface to upload gcode files that are then transferred 
//                to usb-serial connected sanguinulolu. For 3D printing or cnc.
//                Kicked out the direct serial connect and interface with pronsole/printrun instead
//                Make sure you have it installed in /home/pi/printrun/pronsole.py
//                That fixed an issue, sometimes on restart 
//                Lot's of todo's like progress, temperatature monitoring etc.
//                adding jquery mobile theme etc....
var port = 8080; //make this anything you want (mind that you need to sudo if you want port 80)

var formidable = require('formidable'); //file uploads + forms are easy with formidable
var http = require('http');             //the http server
//var sys = require("sys");   //for system calls 
var util = require('util');   //replaces sys

var fs = require('fs'); //moving files

var menu_items = ['home', 'printer', 'files', 'about'];
var command_output = ''; //this will contain output of commands that we're run with runCommand fuction...
var files = []; //array of files uploaded

//we need to just to interface with pronsole.py that works perfectly !
var spawn    = require('child_process').spawn;

///home/pi/printrun/pronsole.py
//var pronsole = spawn('python', ['/home/pi/printrun/test2.py','']);
var pronsole = spawn('python', ['/home/pi/printrun/pronsole.py','']);


//in future we might use the serialport directly here...
//var repl = require("repl"); //for having interactive shell
//var serialport = require("serialport"); //connecto to our arduino or sanguinulolu based 3d printer here !
//var SerialPort = serialport.SerialPort; // localize object constructor for serial interface


function menu_item( response, item ){
  response.write( '<td align="center"><b><a href="/'+item+'">'+item+'</a></b></td>');
}

function menu( response ){
  response.write('<tr>');
  for( i=0;i<menu_items.length;i++){
    menu_item( response, menu_items[i] );
  }
  response.write('</tr>');
  response.write('<tr><td colspan="'+menu_items.length.toString()+'" height="400" valign="top" padding="10px">');
}

function header( response ){
  response.writeHead(200, {'content-type': 'text/html'});
  response.write('<html><body bgcolor="#888888" color="#224422" link="#224422" vlink="#228822" style="background-image:url(images/background.jpg)">'); //background does not work, again we don't care much about styling now (we will use express js in future ...).
  response.write('<center><table class="layout" border="1" width="800" bgcolor="#EEEEEE">');
  response.write('<tr><td colspan="'+menu_items.length.toString()+'"><h1>Printerface for Raspberry Pi</h1></td></tr>');
  menu( response );
}

function footer( response ){
  response.write( '</td></tr>');
  response.write('<tr> <td colspan="2"> Server port = '+ port.toString()  +' </td>     <td colspan="'+(menu_items.length-2).toString()+'"> Author: Walter Schreppers</td></tr>')
  
  response.write('</table></center></body></html>' );
  response.end();
}

function showAboutPage( response ){
  header( response );
  response.write('Written on a sunday by Walter Schreppers<br/>Why? Because : YES we can! <br/> Ow and yeah because it\'s cool: <br/>1. Print anywhere in the world to your reprap at home! <br/> 2. Stop messing with swapping SD cards just upload and print. <br/>3. Build farms of bots all controllable from a single server etc...');
}

function showUploadForm( res ){
  // show a file upload form
  header( res );
  res.write('Upload a file for printing');
  res.write(
    '<form action="/upload" enctype="multipart/form-data" method="post">'+
    '<input type="text" name="title"><br>'+
    '<input type="file" name="upload" multiple="multiple"><br>'+
    '<input type="submit" value="Upload">'+
    '</form>'
  );
}

//is only used for showing after upload... todo change this mess ;)
function showPrintPage( response ){
  //header( res );
  showUploadForm( response );
  response.write('todo connect to serial here...');
}

//actual page to control our printer with pronsole ;)
function showPrinterPage( res ){
  //start pronsole
  //reset printer
  //show some links here
  header( res );

  res.write( '<center>' );
  res.write( '<table width="780px">');
  res.write( '<tr><td>&nbsp;</td><td>' );
    res.write( '<a href="moveforward">^ forward</a>' );
  res.write( '</td><td>&nbsp;</td><td>&nbsp;</td></tr>' );

  res.write( '<tr><td>' );
    res.write( '<a href="moveleft"><- left</a>' );
  res.write( '</td><td>&nbsp;</td><td>' );
    res.write( '<a href="moveright">right -></a>' );
  res.write( '</td><td> <a href="moveup">Move up ^</a> <br/><br/> <a href="movedown">Move down v</a>' );
  res.write( '</td><td> <a href="/heatoff">Heat OFF</a> <br/> <a href="heaton">Heat to 210 degrees</a> <br/> '+ 
             '<br/><a href="extrude">Extrude 5mm</a> <a href="retract">Retract 5mm</a>'+
             '<br/><br/><a href="/printfile">PRINT G-CODE!</a>   </td><td>' );
  res.write( '</td></tr>' );
  
  res.write( '<tr><td>&nbsp;</td><td>' );
    res.write( '<a href="moveback">v backward</a>' );
  res.write( '</td><td>&nbsp;</td><td>&nbsp;</td></tr>' );

  res.write('</table>');

  res.write('</center>');

  res.write( '<br/><a href="homexy">Home X & Y ax </a> <br/>' );
  res.write( '<a href="homez">Home Z ax </a><br/><br/>' );

  //todo show snapshot of printer here or status or stuff...
  footer(res);
}

//todo add some checks in future here, for now it does the job ;)
function moveFile( source_file, target_file ){
      var is = fs.createReadStream(source_file)
      var os = fs.createWriteStream(target_file);

      util.pump(is, os, function() {
        fs.unlinkSync( source_file ); 
        //we update the directory after the move...
        runCommand( 'ls', '-tr1', '/home/pi/printerface/gcode_uploads' );
      });

      //the fs.rename does not work for me, i want to move from /tmp to a different dir in /home
      //move temp file into gcode_uploads dir with original filename 
      //fs.rename( tempfile, targetfile, function(error){
      //  if( error ){ 
    //    res.write('Oops could not move uploaded file');
      //    return;
      //  }
      //  res.write('thanks, all done!');
      //} );
}

//needs both request and response vars (request to get file data, response to show results...)
function parseFileUpload( req, res ){
    // parse a file upload
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
      //res.writeHead(200, {'content-type': 'text/plain'});
      showPrintPage( res ); 
      //header( res );
      res.write('<pre>\n');
      //res.write(util.inspect({fields: fields, files: files})); //handy snippet to show the fields submitted
      var tempfile    = files['upload']['path'];
      var targetfile  = '/home/pi/printerface/gcode_uploads/'+files['upload']['name'];
      moveFile( tempfile, targetfile );

      res.write('Thanks for the upload. saved file to:'+targetfile);
      res.write('</pre>\n');

      //res.end('');
      //now move the file into gcode_uploads
      footer( res );
    });

}

function runCommand( command, args, dir ){
  //var spawn   = require('child_process').spawn;
  var command = spawn(command, [args, dir]);

  command_output = '';
  command.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
    command_output = command_output+ data;
  });

  command.stderr.on('data', function (data) {
    //console.log('stderr: ' + data);
    command_output = command_output + data;
  });

  command.on('exit', function (code) {
    //console.log('child process exited with code ' + code);
    files = command_output.toString().split('\n');
    files.splice(files.length-1,1); //removes last empty entry here...
  });
    
}

//everything is async, this kinda sucks here, we need to call this thing even before we go to the page... test it now here use a global var here...
function showFilesPage( response ){
  header( response );
  response.write('<pre>');
  response.write( command_output );
  response.write('</pre>');
  footer( response );
} 

var printserver = http.createServer(function(req, res) {
  if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
    parseFileUpload( req, res );
    return; //making it trickle down does not seem to work here??? 
  }
  else if( req.url == '/about' ){
    showAboutPage( res );
  }
  else if( req.url == '/print' ){
    showPrintPage( res );
  }

  else if( req.url == '/printer' ){
    showPrinterPage( res );
  }
  else if( req.url == '/moveleft' ){
    console.log('-- move left --');
    pronsole.stdin.write('move x -10\n');
    showPrinterPage( res );
  }
  else if( req.url == '/moveright' ){
    console.log('-- move right --');
    pronsole.stdin.write('move x 10\n');
    showPrinterPage( res );
  }
  else if( req.url == '/moveup' ){
    console.log('-- move up --');
    pronsole.stdin.write('move z 10\n');
    showPrinterPage( res );
  }
  else if( req.url == '/movedown' ){
    console.log('-- move down --');
    pronsole.stdin.write('move z -10\n');
    showPrinterPage( res );
  }
  else if( req.url == '/moveback' ){
    console.log('-- move backward --');
    pronsole.stdin.write('move y -10\n');
    showPrinterPage( res );
  }
  else if( req.url == '/moveforward' ){
    console.log('-- move forward ==');
    pronsole.stdin.write('move y 10\n');
    showPrinterPage( res );
  }
  else if( req.url == '/homexy' ){
    console.log('home x and y');
    pronsole.stdin.write('home xy\n');
    showPrinterPage( res );
  }
  else if( req.url == '/homez' ){
    console.log('home x and y');
    pronsole.stdin.write('home z\n');
    showPrinterPage( res );
  }
  else if( req.url == '/heaton' ){
    console.log('setting heat to 210 degrees');
    pronsole.stdin.write('settemp 210\n');
    showPrinterPage( res );
  }
  else if( req.url == '/extrude' ){
    console.log('extrude 5mm filament');
    pronsole.stdin.write('extrude 5\n');
    showPrinterPage( res );
  }
  else if( req.url == '/retract' ){
    console.log('retract 5mm filament');
    pronsole.stdin.write('extrude -5\n');
    showPrinterPage( res );
  }

  else if( req.url == '/printfile' ){
    var lastfile = files[files.length-1].toString();
    console.log('last file='+lastfile +"\n");
    pronsole.stdin.write( 'load /home/pi/printerface/gcode_uploads/'+lastfile+"\n" );
    pronsole.stdin.write( 'print\n' );
    showPrinterPage( res );
  }
  else if( req.url == '/heatoff' ){
    console.log('setting temp off!');
    pronsole.stdin.write( 'settemp 0\n' );
    showPrinterPage( res );
  }


  else if( req.url == '/files' ){
    showFilesPage( res );
  }
  else{ //the home is show upload form for uploading gcode file to print ;)
    showUploadForm( res );
  }

  footer( res );
});

//todo make it somehow different here...
//this makes the list of uploaded files available
runCommand( 'ls', '-tr1', '/home/pi/printerface/gcode_uploads' );

console.log('pronsole.py is spawned, waiting 3 seconds and sending connect...');
setTimeout( function(){
  //calling connect without params here (todo add ttyUSB etc, but hey the defaults work just fine now ;)
  pronsole.stdin.write('connect\n');
}, 3000 );

//console.log('pronsole.py is spawned, waiting 3 seconds and sending monitor...');
//setTimeout( function(){
  //calling connect without params here (todo add ttyUSB etc, but hey the defaults work just fine now ;)
//  pronsole.stdin.write('monitor\n'); //cool this just works like we want -> need some ajax though to feed it back to the browser...
//}, 3000 );



pronsole.stdout.on('data', function (data) {
  console.log( 'pronsole: '+data ); //todo use some ajax to feed it to our browser here...
});

pronsole.stderr.on('data', function (data) {
  console.log('pronsole err: ' + data);
});

pronsole.stdout.on('end', function(data) {
  pronsole.stdout.end();
} );

pronsole.on('exit', function (code) {
  if (code !== 0) {
    console.log('pronsole process exited with code ' + code);
  }
  console.log('pronsole exited!');
  pronsole.stdin.end(); 
  //todo just respawn pronsole here!!!
});


//Start webserver on port specified here. 
printserver.listen(port);


//Start an interactive shell (remove on production, uhu not for this sunday most likely ;))
//repl.start("=>");


