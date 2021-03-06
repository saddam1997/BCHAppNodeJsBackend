/**
 * TxdetailsController
 *
 * @description :: Server-side logic for managing txdetails
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

 //Block.io Details.........
 var BlockIo = require('block_io');
 var version = sails.config.company.BTCServerversion;
 var secreatePin=sails.config.company.BTCServersecreatePin;
 var API_KeyofBlockIo=sails.config.company.BTCServerAPI_KeyofBlockIo;
 var block_io = new BlockIo(sails.config.company.BTCServerAPI_KeyofBlockIo, sails.config.company.BTCServersecreatePin, version);
 var companyBTCAccount=sails.config.company.companyBTCAccount;
 var companyBTCAccountAddress=sails.config.company.companyBTCAccountAddress;

 //BCH Wallet Details
 var bitcoinBCH = require('bitcoin');
 var clientBCH = new bitcoinBCH.Client({
   host: sails.config.company.clientBCHhost,
   port: sails.config.company.clientBCHport,
   user: sails.config.company.clientBCHuser,
   pass: sails.config.company.clientBCHpass
 });
 var companyBCHAccount=sails.config.company.companyBCHAccount;
 var companyBCHAccountAddress=sails.config.company.companyBCHAccountAddress;

module.exports = {

	bchTransactionDetails: function(req, res) {
		console.log("Enter into bchTransactionDetails !!!");
		var txid=req.body.txid;
		if(!txid){
			console.log("txid not found");
			return res.json({"message":"Send TxId" ,statusCode: 400});
		}
		clientBCH.cmd(
			'gettransaction',
			txid,
			function(err, transactionDetails) {
				if (err) {
							console.log("Error from sendFromBCHAccount:: ");
							if(err.code && err.code== "ECONNREFUSED"){
									return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
							}
							if(err.code && err.code== -5){
									return res.json({"message":"Invalid or non-wallet transaction id" ,statusCode: 400});
							}
							if(err.code && err.code < 0){
								
									return res.json({"message":"Problem in BCH server",statusCode: 400});
							}
							return res.json({"message":"Error in BCH Server",statusCode: 400});
				}
				console.log("Return transactionDetails List !! ");
				return res.json({"tx": transactionDetails,statusCode: 200});
		});
	},
	btcTransactionDetails: function(req, res) {
		var txid=req.body.txid;
		if(!txid){
			console.log("txid not found");
			return res.json({"message":"Send TxId" ,statusCode: 400});
		}

	}

};
