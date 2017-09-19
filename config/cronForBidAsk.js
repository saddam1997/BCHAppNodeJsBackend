var request = require('request');
var async = require('async');

//Block.io Details.........
var BlockIo = require('block_io');
var version = 2;
var secreatePin="Saddam1508";
var API_KeyofBlockIo="7ba8-e0ba-8223-7bbe";
var block_io = new BlockIo(API_KeyofBlockIo, secreatePin, version);
var companyBTCAccount="penny.saddam@gmail.com";
var companyBTCAccountAddress="2N4iBd2rsb2JRxn5uDuxH1jr6x3Jn1nSkzB";

//BCH Wallet Details
var bitcoinBCH = require('bitcoin');
var clientBCH = new bitcoinBCH.Client({
  host: 'localhost' ,
  port: 18332,
  user: 'test',
  pass: 'test123'
});
var companyBCHAccount="pennybch@gmail.com";
var companyBCHAccountAddress="mjnTqHDMoKwkNkdxvwSgxYSKVjkCkFpekG";

module.exports.cron = {
  searchBidJob: {
    schedule: '60 * * * * *',
    onTick: function () {
      console.log("Search in Bid table!!!");
      var options = { method: 'GET',
        url: 'https://cex.io/api/ticker/BCH/BTC',
        headers:
         { accept: '*/*',
           'content-type': 'application/json',
           'accept-language': 'en-US,en;q=0.8' },
        json: true
      };
      request(options, function (error, response, body) {
        if (error) {
          console.log("Error to get current BCH Price");

        }else {

          console.log("Returning Current price of BCH "+body);
          var currentBCHPriceDetailsJSON=body;
          var currentBCHBidPrice=currentBCHPriceDetailsJSON.bid;
          console.log("currentPRiceDetails "+currentBCHBidPrice);

          Bid.find(
            { bidRate: { '>=': currentBCHBidPrice }
          })
          .exec(function (err, allBidDetailsToExecute){
            if (err) {
              console.log("Error to find bid");
            }
            if(!allBidDetailsToExecute){
                console.log("No bid found");
            }
            if(allBidDetailsToExecute){

            if(allBidDetailsToExecute.length >= 1){

                console.log("Total Bid to execute :: "+allBidDetailsToExecute.length);
                async.forEach(allBidDetailsToExecute,function(userBidDetails, callback){
                        console.log("For Loop with user details:: "+userBidDetails.bidowner);
                        User.findOne({
                          id: userBidDetails.bidowner
                        })
                        .populate("bids",{id: userBidDetails.id})
                        .exec(function (err, userAllDetailsInDB){
                          if (err) {
                              console.log("Error to find user");
                          }
                          if (!userAllDetailsInDB) {
                            console.log("Invalid email!");
                          }
                          var bidDetailsSavedInDB=userAllDetailsInDB.bids[0];

                            block_io.withdraw_from_addresses(
                            {
                              'amounts': bidDetailsSavedInDB.bidAmountBTC,
                              'from_addresses': userAllDetailsInDB.userBTCAddress,
                              'to_addresses':  companyBTCAccountAddress,
                              'pin': secreatePin
                            },
                            function (error, withdrawTransactioDetails) {
                              if (error){
                                console.log("Error from Block.io "+JSON.stringify(withdrawTransactioDetails));
                                if(!withdrawTransactioDetails){
                                  console.log( "Error to connect with BTC Server");
                                }
                                console.log("Error to connect with BTC Server");
                              }
                              else {

                                var amountSentFromUserBTCAccount=withdrawTransactioDetails.data.amount_sent;
                                var amountSentNetworkFee=withdrawTransactioDetails.data.network_fee;
                                var updatedFreezedBTCbalance = (parseFloat(userAllDetailsInDB.FreezedBTCbalance).toFixed(8) -
                                                         parseFloat(amountSentFromUserBTCAccount).toFixed(8));
                                var updatedBTCbalanceDeductNetworkFee = (parseFloat(userAllDetailsInDB.BTCbalance).toFixed(8) -
                                                                  parseFloat(amountSentNetworkFee).toFixed(8));

                                var minimumNumberOfConfirmation=3;
                                clientBCH.cmd('sendfrom',
                                  companyBCHAccount,
                                  userAllDetailsInDB.userBCHAddress,
                                  bidDetailsSavedInDB.bidAmountBCH,
                                  minimumNumberOfConfirmation,
                                  companyBCHAccountAddress,
                                  companyBCHAccountAddress,
                                  function(err, TransactionDetails, resHeaders) {
                                    if (err){
                                          console.log("Error from sendFromBCHAccount:: ");
                                          if(err.code && err.code== "ECONNREFUSED"){
                                            console.log("BCH Server Refuse to connect App");
                                          }
                                          if(err.code && err.code== -5){
                                            console.log("Invalid BCH Address");
                                          }
                                          if(err.code && err.code== -6){
                                              console.log("Account has Insufficient funds" );
                                          }
                                          if(err.code && err.code < 0){
                                              console.log("Problem in BCH server" );
                                          }
                                          console.log("Error in BCH Server");
                                    }
                                    console.log('Company BCH Sent Succesfully in UserBCHAddress txid: ', TransactionDetails);
                                    clientBCH.cmd('gettransaction', TransactionDetails,
                                      function(err, compleateTransactionDetails, resHeaders) {
                                        if (err){
                                              console.log("Error from gettransaction:: ");
                                              if(err.code && err.code== "ECONNREFUSED"){
                                                  console.log("BCH Server Refuse to connect App");
                                              }
                                              if(err.code && err.code < 0){
                                                  console.log("Problem in getTransaction BCH server");
                                              }
                                              console.log("Error in BCH Server");
                                        }
                                        var networkFeeByBCHServerForThisTransaction = parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8);
                                        var updatedBCHbalance = (parseFloat(userAllDetailsInDB.BCHbalance) + parseFloat(bidDetailsSavedInDB.bidAmountBCH)).toFixed(8);
                                        updatedBCHbalance = parseFloat(updatedBCHbalance).toFixed(8) -  parseFloat(networkFeeByBCHServerForThisTransaction).toFixed(8);

                                        User.update({
                                            id: userBidDetails.bidowner
                                          }, {
                                            BTCbalance: parseFloat(updatedBTCbalanceDeductNetworkFee).toFixed(8),
                                            FreezedBTCbalance: parseFloat(updatedFreezedBTCbalance).toFixed(8),
                                            BCHbalance: parseFloat(updatedBCHbalance).toFixed(8)
                                          })
                                          .exec(function(err, updatedUser) {
                                            if (err) {
                                              console.log("Error to update User");
                                            }
                                            console.log("User details Updated Succesfully");
                                            Bid.destroy({
                                              id: bidDetailsSavedInDB.id
                                            }).exec(function (err){
                                              if (err) {
                                                return  res.json({
                                                  "message": "Error to remove bid",
                                                  statusCode: 400
                                                });
                                              }
                                              console.log("Bid removed.... Succesfully");
                                            });
                                          });
                                      });
                                  });
                              }
                            });
                        });
                        callback();
                },
                function(err){
                 if(err){
                   console.log("Error in async");
                 }
                 console.log("Bid of all user executed successfully");
                });

            }
            else{
              console.log("No record found for current price :: "+allBidDetailsToExecute.length);
            }
            }
          });
        }


      });
    }
  },
  searchAskJob: {
    schedule: '60 * * * * *',
    onTick: function() {
      console.log("Search in ask table");
      var options = { method: 'GET',
        url: 'https://cex.io/api/ticker/BCH/BTC',
        headers:
         { accept: '*/*',
           'content-type': 'application/json',
           'accept-language': 'en-US,en;q=0.8' },
        json: true
      };
      request(options, function (error, response, body) {
        if (error) {
          console.log("Error to get current BCH Price");

        }else {


          var currentBCHPriceDetailsJSON=body;

              if(!currentBCHPriceDetailsJSON){
                console.log("Error to get current BCH Price of Ask");
              }else {

                var currentBCHAskPrice=currentBCHPriceDetailsJSON.ask;
                console.log("currentBCHAskPrice::::  "+currentBCHAskPrice);

                Ask.find(
                {askRate: {'<=': currentBCHAskPrice }})
                .exec(function (err, allAskDetailsToExecute){
                    if (err) {
                      console.log("Error to find ask");
                    }
                    if(!allAskDetailsToExecute){
                        console.log("No ask found");
                    }
                    if(allAskDetailsToExecute){
                      if(allAskDetailsToExecute.length >= 1){
                        console.log("Asks records found :: "+allAskDetailsToExecute.length);

                        async.forEach(allAskDetailsToExecute,function(userAskDetails, callback){
                                console.log("For Loop with user details:: "+userAskDetails.askowner);
                                User.findOne({
                                  id: userAskDetails.askowner
                                })
                                .populate("asks",{id: userAskDetails.id})
                                .exec(function (err, userAllDetailsInDB){
                                  if (err) {
                                      console.log("Error to find user");
                                  }
                                  if (!userAllDetailsInDB) {
                                    console.log("Invalid userId!");
                                  }else{
                                    var askDetailsSavedInDB=userAllDetailsInDB.asks[0];
                                    console.log("SendFrom :::::: "+userAllDetailsInDB.email);
                                    console.log("askDetailsSavedInDB.askAmountBCH :::::: "+askDetailsSavedInDB.askAmountBCH);
                                    clientBCH.cmd('sendfrom',
                                      userAllDetailsInDB.email,
                                      companyBCHAccountAddress,
                                      askDetailsSavedInDB.askAmountBCH,
                                      3,
                                      companyBCHAccountAddress,
                                      companyBCHAccountAddress,
                                      function(err, TransactionBCHTxId, resHeaders) {
                                        if (err){
                                          console.log("Error from sendFromBCHAccount:: "+err);
                                          if(err.code && err.code== "ECONNREFUSED"){
                                            console.log("BCH Server Refuse to connect App");
                                          }
                                          if(err.code && err.code== -5){
                                            console.log("Invalid BCH Address");

                                          }
                                          if(err.code && err.code== -6){
                                            console.log("Account has Insufficient funds");

                                          }
                                          if(err.code && err.code < 0){
                                              console.log("Problem in BCH server");
                                          }
                                          console.log("Error in BCH Server");
                                        }else {
                                          console.log('BCH Send Succesfully from userId to Company account txid : '+TransactionBCHTxId);
                                          clientBCH.cmd('gettransaction', TransactionBCHTxId,
                                            function(err, compleateTransactionBCHDetails, resHeaders) {
                                              if (err){
                                                console.log("Error from sendFromBCHAccount:: ");
                                                if(err.code && err.code < 0){
                                                  console.log("Problem in BCH server" );
                                                }
                                                console.log("Error in BCH Server");
                                              }
                                              var networkFeeByBCHServerForThisTransaction=parseFloat(Math.abs(compleateTransactionBCHDetails.fee)).toFixed(8);
                                              console.log("Fee :: " +networkFeeByBCHServerForThisTransaction);
                                              var updatedFreezedBCHbalance = (parseFloat(userAllDetailsInDB.FreezedBCHbalance).toFixed(8) - parseFloat(askDetailsSavedInDB.askAmountBCH).toFixed(8));
                                              var updatedBCHbalance = parseFloat(userAllDetailsInDB.BCHbalance).toFixed(8) - parseFloat(networkFeeByBCHServerForThisTransaction).toFixed(8);
                                              block_io.withdraw_from_addresses(
                                              {
                                                'amounts': parseFloat(askDetailsSavedInDB.askAmountBTC).toFixed(8),
                                                'from_addresses': companyBTCAccountAddress,
                                                'to_addresses':  userAllDetailsInDB.userBTCAddress,
                                                'pin': secreatePin
                                              },
                                              function (error, withdrawTransactioDetails) {
                                                if (error){
                                                  console.log("Error from Block.io "+JSON.stringify(withdrawTransactioDetails));
                                                  if(!withdrawTransactioDetails){
                                                    console.log("Error to connect with BTC Server");
                                                  }
                                                  console.log(withdrawTransactioDetails.data.error_message);
                                                }
                                                var updatedBTCbalance =
                                                (parseFloat(userAllDetailsInDB.BTCbalance) +
                                                parseFloat(withdrawTransactioDetails.data.amount_sent)).toFixed(8);
                                                // console.log("User BCH balance In DB ::: "+userBCHBalanceInDb);
                                                // console.log("UpdateUser BCH balance ::: "+updatedBCHbalance);
                                                // console.log("User BCH usersellAmountBCH  ::: "+usersellAmountBCH);
                                                // console.log("Fee :: " +networkFeeByBCHServerForThisTransaction);
                                                // console.log("\nUser BTC balance In DB ::: "+userBTCBalanceInDb);
                                                // console.log("User BCH usersellAmountBTC  ::: "+usersellAmountBTC);
                                                // console.log("UpdateUser BTC balance ::: "+updatedBTCbalance);
                                                console.log("updatedBTCbalance ::"+updatedBTCbalance);
                                                console.log("updatedBCHbalance ::"+updatedBCHbalance);
                                                console.log("updatedFreezedBCHbalance ::"+updatedFreezedBCHbalance);
                                                User.update({
                                                    id: userAskDetails.askowner
                                                  }, {
                                                    BTCbalance: parseFloat(updatedBTCbalance).toFixed(8),
                                                    BCHbalance: parseFloat(updatedBCHbalance).toFixed(8),
                                                    FreezedBCHbalance: parseFloat(updatedFreezedBCHbalance).toFixed(8),
                                                  })
                                                  .exec(function(err, updatedUser) {
                                                    if (err) {
                                                        console.log("Error to udpate .....");

                                                    }else {
                                                      Ask.destroy({
                                                        id: askDetailsSavedInDB.id
                                                      }).exec(function (err){
                                                        if (err) {
                                                          console.log("Error to remove bid");
                                                        }
                                                        console.log("Ask removed.... Succesfully");
                                                      });
                                                    }
                                                  });
                                              });
                                            });
                                        }
                                      });

                                  }

                                });
                                callback();
                        },
                        function(err){
                         if(err){
                           console.log("Error in async");
                         }
                         console.log("Bid of all user executed successfully");
                        });

                      }else{
                        console.log("No record found for current price in ask table :: "+allAskDetailsToExecute.length);
                      }
                    }
                  });
                }

            }
        });

    }
  }
};
