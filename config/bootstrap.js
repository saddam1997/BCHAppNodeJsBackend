/**
 * Bootstrap
 * (sails.config.bootstrap)
 *
 * An asynchronous bootstrap function that runs before your Sails app gets lifted.
 * This gives you an opportunity to set up your data model, run jobs, or perform some special logic.
 *
 * For more information on bootstrapping your app, check out:
 * http://sailsjs.org/#!/documentation/reference/sails.config/sails.config.bootstrap.html
 */
 var bitcoinBCH = require('bitcoin');
 var clientBCH = new bitcoinBCH.Client({
   host: 'localhost' ,
   port: 18332,
   user: 'test',
   pass: 'test123'
 });

module.exports.bootstrap = function(cb) {

  // It's very important to trigger this callback method when you are finished
  // with the bootstrap!  (otherwise your server will never lift, since it's waiting on the bootstrap)
  console.log("check BCH Server running or not ...");

  clientBCH.cmd('getinfo',function(err, newBCHDetails, resHeaders) {
    if (err){
          console.log("BCH Server not running................."+newBCHDetails);
    }else{
      console.log("BCH Server  running................."+JSON.stringify(newBCHDetails));
        cb();
    }

  });

};
