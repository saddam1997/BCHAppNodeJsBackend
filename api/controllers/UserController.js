/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

 //External Dependencies.........
var request = require('request');
var bcrypt = require('bcrypt');
var nodemailer = require('nodemailer');
var mergeJSON = require("merge-json") ;
var validator = require('validator');

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
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'wallet.bcc@gmail.com',
    pass: 'boosters@123'
  }
});

module.exports = {
  createNewUserBlockIO: function(req, res) {
    console.log("Enter into createNewUserBlockIO :: ");
    var useremailaddress=req.body.email;
    var userpassword=req.body.password;
    var userconfirmPassword=req.body.confirmPassword;
    var userspendingpassword=req.body.spendingpassword;
    if(!validator.isEmail(useremailaddress)){
      return  res.json({
        "message": "Please Enter valid email id",
        statusCode: 400
      });
    }
    if (!useremailaddress || !userpassword || !userconfirmPassword || !userspendingpassword){
      console.log("User Entered invalid parameter ");
      return  res.json({
        "message": "Invalid Parameter",
        statusCode: 400
      });
    }
    if (userpassword !== userconfirmPassword){
      console.log("Password and confirmPassword doesn\'t match!");
      return res.json({
        "message": 'Password and confirmPassword doesn\'t match!',
        statusCode: 400
      });
    }
    User.findOne({
      email: useremailaddress
    }, function(err, user) {
      if (err) {
        console.log("Error to find user from database");
        return res.json({
          "message":"Error to find User",
          statusCode: 400
        });
      }
      if (user) {
        console.log("Use email exit and return ");
        return res.json({
          "message": 'email already exit',
          statusCode: 400
        });
      }
      if (!user) {
      block_io.get_new_address({'label': useremailaddress},
        function (error, newCreateAddressDetails) {
          if (error){
            console.log("Error from Block.io "+JSON.stringify(newCreateAddressDetails));
            if(!newCreateAddressDetails){
              return res.json({"message": "Error to connect with BTC Server",statusCode: 400});
            }
            return res.json({"message": newCreateAddressDetails.data.error_message,statusCode: 400});
          }
          console.log("New address create for user from block.io ::"+newCreateAddressDetails.data.address);
          var userBtcAddresByBlockIO=newCreateAddressDetails.data.address;
              clientBCH.cmd('getnewaddress', useremailaddress, function(err, newBCHAddressForUser, resHeaders) {
                if (err){
                      console.log("Error from sendFromBCHAccount:: ");
                      if(err.code && err.code== "ECONNREFUSED"){
                          return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
                      }
                      if(err.code && err.code < 0){
                          return res.json({"message":"Problem in BCH server" ,statusCode: 400});
                      }
                      return res.json({"message":"Error in BCH Server",statusCode: 400});
                }
                console.log('New address created from BCHServer :: ', newBCHAddressForUser);
                bcrypt.hash(userspendingpassword, 10, function(err, hashspendingpassword) {
                  if (err) {
                      console.log("Error To bcrypt spendingpassword");
                      return res.json( {
                          "message": err,
                          statusCode:500
                      });
                  }
                  var userObj = {
                    email: useremailaddress,
                    password: userpassword,
                    encryptedSpendingpassword: hashspendingpassword,
                    userBTCAddress: userBtcAddresByBlockIO,
                    userBCHAddress: newBCHAddressForUser
                  }

                  User.create(userObj).exec(function (err, userAddDetails){
                    if(err){

      								console.log("Error to Create New user !!!");
                      console.log(err);
                      return  res.json({
      									"message": "Error to create New User",
      									statusCode: 400
      								});
      							}
                    return res.json(200, {
                      "message": "User created Succesfully",
                      statusCode: 200
                    });
                  });
                });
              });
        });
      }
    });
  },
  sendBTCCoinByUserWithFeeBlockIO: function(req, res, next) {
    console.log("Enter into sendBTCCoinByUserWithFeeBlocIO ");
    var userEmailAddress=req.body.userMailId;
    var userAmountToSend=parseFloat(req.body.amount).toFixed(8);
    var userReceiverBTCAddress=req.body.recieverBTCCoinAddress;
    var userSpendingPassword=req.body.spendingPassword;
    var userCommentForReceiver=req.body.commentForReciever;
    var userCommentForSender=req.body.commentForSender;
    var miniValueOfAmountSentByUser=0.0001;
    miniBTCAmountSentByUser=parseFloat(miniValueOfAmountSentByUser).toFixed(8);
    if(!userEmailAddress ||!userAmountToSend  || !userReceiverBTCAddress||
      !userSpendingPassword||!userCommentForReceiver ||!userCommentForSender){
      console.log("Invalid Parameter by user ");
      return res.json( {"message": "Invalid Parameter",statusCode: 400});
    }
    if (userAmountToSend < miniBTCAmountSentByUser) {
      console.log("Sending amount is not less then 0.0001");
      return res.json( {
        "message": "Sending amount BTC is not less then 0.0001",
        statusCode: 400
      });
    }
    User.findOne({
        email: userEmailAddress
    })
    .then(function(userDetails) {
      if(!userDetails){
          console.log(" User id not exit !!!");
          return res.json({"message": " User id not exit",statusCode: 401});
      }
      var userBTCBalanceInDb=parseFloat(userDetails.BTCbalance).toFixed(8);
        console.log("User BTC balance in database ::: " + userBTCBalanceInDb);
        console.log("User want send BTC to send ::: " + userAmountToSend );
        User.compareSpendingpassword(userSpendingPassword, userDetails,
        function(err, valid) {
          if (err) {
            console.log("Eror To compare password !!!");
            return res.json({"message": err,statusCode: 401});
          }
          if (!valid) {
            console.log("Invalid spendingpassword !!!");
            return res.json( {"message": 'Enter valid spending password',statusCode: 401 });
          } else {
            console.log("Valid spending password !!!");
            var userBTCAddressInDb=userDetails.userBTCAddress;
            if (userAmountToSend > userBTCBalanceInDb) {
              console.log("User BTC balance is Insufficient");
              return res.json({"message": "You have Insufficient BTC balance",statusCode: 401});
            }
            block_io.withdraw_from_addresses(
            {
              'amounts': userAmountToSend,
              'from_addresses': userBTCAddressInDb,
              'to_addresses':  userReceiverBTCAddress,
              'pin': secreatePin
            },
            function (error, withdrawBTCTransactioDetails) {
              if (error){
                console.log("Error from Block.io "+JSON.stringify(withdrawBTCTransactioDetails));
                if(!withdrawBTCTransactioDetails){
                  return res.json({"message": "Error to connect with BTC Server",statusCode: 401});
                }
                return res.json({"message": withdrawBTCTransactioDetails.data.error_message,statusCode: 401});
              }
              var userAmountWithdrawFromBlockIOWithNetworkFee=
              parseFloat(withdrawBTCTransactioDetails.data.amount_withdrawn).toFixed(8);
              var updatedBTCbalance = (parseFloat(userBTCBalanceInDb).toFixed(8) -
              parseFloat(userAmountWithdrawFromBlockIOWithNetworkFee).toFixed(8));
              console.log("userAmountWithdraw with network_fee ::: "+userAmountWithdrawFromBlockIOWithNetworkFee);
              console.log("User Updated Balance :: "+updatedBTCbalance);
              User.update({
                  email: userEmailAddress
                }, {
                  BTCbalance: parseFloat(updatedBTCbalance).toFixed(8)
                })
                .exec(function(err, updatedUser) {
                  if (err) {
                    console.log("Error to update user BTC balance");
                    return res.json( {"message": "Error to update User values",statusCode: 401});
                  }
                  User.findOne({email: userEmailAddress}).populateAll()
                    .then(function(user) {
                      console.log("Return Updated User Details :::  "+JSON.stringify(user));
                      res.json({user: user,statusCode: 200});
                    })
                    .catch(function(err) {
                      console.log("Error  to find User Details with mail ");
                      if (err) {res.json({"message":"Error to find user details",statusCode: 401});
                      }
                    });
                });
            });
          }
        });
    })
    .catch(function(err) {
        console.log("Error  to find User Details with mail "+userEmailAddress);
        return res.json({"message":"User Email id not exit",statusCode: 401});
    });
  },
  sendBCHCoinByUserWithFee: function(req, res, next) {
    console.log("Enter into sendBCHCoinByUserWithFee with ::: " + JSON.stringify(req.body));
    var userEmailAddress=req.body.userMailId;
    var userBCHAmountToSend=parseFloat(req.body.amount).toFixed(8);
    var userReceiverBCHAddress=req.body.recieverBCHCoinAddress;
    var userSpendingPassword=req.body.spendingPassword;
    var userCommentForReceiver=req.body.commentForReciever;
    var userCommentForSender=req.body.commentForSender;
    var minimumAmountBCHSentByUser=0.0001;
    miniBCHAmountSentByUser=parseFloat(minimumAmountBCHSentByUser).toFixed(8);
    if(!userEmailAddress ||!userBCHAmountToSend  || !userReceiverBCHAddress||
      !userSpendingPassword|| !userCommentForReceiver || !userCommentForSender){
          console.log("Invalid Parameter by user!!!");
          return res.json({"message": "Invalid Parameter",statusCode: 400});
    }
    if (userBCHAmountToSend < miniBCHAmountSentByUser) {
      console.log("amount in not less 0.0001 !!!");
      return res.json({"message": "Amount not less than 0.0001 !!!",statusCode: 400});
    }
    User.findOne({
      email: userEmailAddress
    }).exec(function (err, userDetails){
      if (err) {
        return res.json( {"message": "Error to find user",statusCode: 401});
      }
      if (!userDetails) {
        return res.json( {"message": "Invalid email!",statusCode: 401});
      }
      var userBCHBalanceInDb = parseFloat(userDetails.BCHbalance).toFixed(8);
      var userBCHAddressInDb = userDetails.userBCHAddress;
      console.log("UserAMount in database ::: " + userDetails.BCHbalance);
      console.log("BCH Amount send by user ::: " + userBCHAmountToSend);
      if (userBCHAmountToSend > userBCHBalanceInDb){
        console.log("BCH Amount amount Exceed !!!");
        return res.json( {"message": "You have Insufficient BCH balance",statusCode: 401});
      }

      if (userReceiverBCHAddress == userBCHAddressInDb){
        console.log("User address and recieverBCHCoinAddress Same !!!");
        return res.json( {"message": "recieverBCHCoinAddress and Your BCH Address Same",statusCode: 401});
      }
      User.compareSpendingpassword(userSpendingPassword, userDetails, function(err, valid) {
        if (err){
          console.log("Error to compare password");
          return res.json({"message": err,statusCode: 400});
        }
        if (!valid) {
          console.log("Spending password is invalid !!!");
          return res.json({ "message": "Please enter correct spending password",statusCode: 400});
        } else {
          console.log("Spending password is valid!!!");
          var minimumNumberOfConfirmation=3;
          clientBCH.cmd('sendfrom',userEmailAddress,userReceiverBCHAddress,userBCHAmountToSend,
            minimumNumberOfConfirmation,userReceiverBCHAddress,userReceiverBCHAddress,
            function(err, TransactionDetails, resHeaders) {
              if (err){
                  console.log("Error from sendFromBCHAccount:: ");
                  if(err.code && err.code== "ECONNREFUSED"){
                      return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
                  }
                  if(err.code && err.code== -5){
                      return res.json({"message":"Invalid BCH Address" ,statusCode: 400});
                  }
                  if(err.code && err.code== -6){
                      return res.json({"message":"Account has Insufficient funds" ,statusCode: 400});
                  }
                  if(err.code && err.code < 0){
                      return res.json({"message":"Problem in BCH server" ,statusCode: 400});
                  }
                  return res.json({"message":"Error in BCH Server",statusCode: 400});
              }
              console.log('TransactionDetails :', TransactionDetails);
              console.log("User balance in db:: " + userBCHBalanceInDb);
              console.log("UserBCHAmountToSend  :: " +userBCHAmountToSend);
              clientBCH.cmd('gettransaction', TransactionDetails,
                function(err, compleateTransactionDetails, resHeaders) {
                  if (err) {
                    return res.json({"message": "Error to get transaction details",statusCode: 400});
                  }
                  var networkFeeByBCHServerForThisTransaction=parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8);
                  console.log("Network Fee by BCH server:: " +networkFeeByBCHServerForThisTransaction);
                  var updatedBCHbalance = userBCHBalanceInDb - userBCHAmountToSend;
                  updatedBCHbalance = updatedBCHbalance - networkFeeByBCHServerForThisTransaction;
                  console.log("Update new Balance of user in DB ::" +updatedBCHbalance);
                  User.update({
                      email: userEmailAddress
                    }, {
                      BCHbalance: updatedBCHbalance
                    })
                    .exec(function(err, updatedUser) {
                      if (err) {
                        return res.json( { "message": "Error to update User", statusCode: 400});
                      }
                      User
                        .findOne({
                          email: userEmailAddress
                        }).populateAll()
                        .then(function(user) {
                          console.log("User return "+JSON.stringify(user));
                          res.json({
                            user: user,
                            statusCode: 200
                          });
                        })
                        .catch(function(err) {
                          if (err) {
                            return res.json( {
                                    "message": "Error to find user Email",
                                    statusCode: 400
                            });
                          }
                        });
                    });
                });
            });
        }
      });
    });
  },
  sellBCHCoinByUserWithFeeBlockIO: function(req, res, next) {
    console.log("Enter into sellBCHCoinByUserWithFeeBlockIO with ::: " + JSON.stringify(req.body));
    var userEmailId=  req.body.userMailId ;
    var usersellAmountBTC=  parseFloat(req.body.sellAmountBTC).toFixed(8);
    var usersellAmountBCH=  parseFloat(req.body.sellAmountBCH).toFixed(8);
    var userSpendingPassword=  req.body.spendingPassword;
    var userCommentForReciever=  req.body.commentForReciever;
    var userCommentForSender=  req.body.commentForSender;
    var minimumAmountBCHToSell=0.0001;

    if(!userEmailId ||  !usersellAmountBTC  ||  !usersellAmountBCH  ||
      !userSpendingPassword||  !userCommentForReciever ||  !userCommentForSender){
      console.log("Invalid Parameter by user!!!");
      return res.json({"message": "Invalid Parameter",statusCode: 400});
    }
    if (usersellAmountBCH <= minimumAmountBCHToSell) {
      console.log("amount in not less the 0.0001 !!!");
      return res.json( {
        "message": "BCH amount for sell is not less0.0001",
        statusCode: 400
      });
    }
    User.findOne({email: userEmailId})
      .exec(function(err, userDetails) {
        if (err) {
          console.log("Error to get userDetails!!!");
          return res.json( {"message": "Error to get user details",statusCode: 400});
        }
        if (!userDetails) {
          return res.json( {"message": "Invalid email!",statusCode: 401});
        }
        var userBTCBalanceInDb=parseFloat(userDetails.BTCbalance).toFixed(8);
        var userBCHBalanceInDb=parseFloat(userDetails.BCHbalance).toFixed(8);
        var userBTCAddressInDb=userDetails.userBTCAddress;
        var userBCHAddressInDb=userDetails.userBCHAddress;

        console.log("userBCHBalanceInDb :: "+userBCHBalanceInDb);
        console.log("usersellAmountBCH :: "+usersellAmountBCH);
        if (usersellAmountBCH > userBCHBalanceInDb) {
          console.log(" User have Insufficient fund!!! ");
          return  res.json( {"message": "Amount exceed for this transaction",  statusCode: 400});
        }
        User.compareSpendingpassword(userSpendingPassword, userDetails, function(err, valid) {
          if (err) {
            console.log("Error to Compare Spedning password");
            return res.json({"message": err,statusCode: 400});
          }
          if (!valid) {
            console.log("Invalid Spending password!!!");
            return  res.json({"message": "invalid spendingpassword",statusCode: 400});
          } else {

            console.log("User spendingpassword is valid::");
            clientBCH.cmd('sendfrom',
              userEmailId,
              companyBCHAccountAddress,
              parseFloat(usersellAmountBCH).toFixed(8),
              3,
              companyBCHAccountAddress,
              companyBCHAccountAddress,
              function(err, TransactionBCHTxId, resHeaders) {
                if (err){
                  console.log("Error from sendFromBCHAccount:: ");
                  if(err.code && err.code== "ECONNREFUSED"){
                      return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
                  }
                  if(err.code && err.code== -5){
                      return res.json({"message":"Invalid BCH Address" ,statusCode: 400});
                  }
                  if(err.code && err.code== -6){
                      return res.json({"message":"Account has Insufficient funds" ,statusCode: 400});
                  }
                  if(err.code && err.code < 0){
                      return res.json({"message":"Problem in BCH server" ,statusCode: 400});
                  }
                  return res.json({"message":"Error in BCH Server",statusCode: 400});
                }
                console.log('BCH Send Succesfully from userId to Company account txid : '+TransactionBCHTxId);
                clientBCH.cmd('gettransaction', TransactionBCHTxId,
                  function(err, compleateTransactionBCHDetails, resHeaders) {
                    if (err){
                      console.log("Error from sendFromBCHAccount:: ");
                      if(err.code && err.code < 0){
                          return res.json({"message":"Problem in BCH server" ,statusCode: 400});
                      }
                      return res.json({"message":"Error in BCH Server",statusCode: 400});
                    }
                    var networkFeeByBCHServerForThisTransaction=parseFloat(Math.abs(compleateTransactionBCHDetails.fee)).toFixed(8);
                    console.log("Fee :: " +networkFeeByBCHServerForThisTransaction);
                    var updatedBCHbalance = (parseFloat(userBCHBalanceInDb).toFixed(8) - parseFloat(usersellAmountBCH).toFixed(8));
                    updatedBCHbalance = updatedBCHbalance - parseFloat(networkFeeByBCHServerForThisTransaction).toFixed(8);
                    block_io.withdraw_from_addresses(
                    {
                      'amounts': parseFloat(usersellAmountBTC).toFixed(8),
                      'from_addresses': companyBTCAccountAddress,
                      'to_addresses':  userBTCAddressInDb,
                      'pin': secreatePin
                    },
                    function (error, withdrawTransactioDetails) {
                      if (error){
                        console.log("Error from Block.io "+JSON.stringify(withdrawTransactioDetails));
                        if(!withdrawTransactioDetails){
                          return res.json({"message": "Error to connect with BTC Server",statusCode: 400});
                        }
                        return res.json({"message": withdrawTransactioDetails.data.error_message,statusCode: 400});
                      }

                      var updatedBTCbalance =
                      (parseFloat(userBTCBalanceInDb) +
                      parseFloat(withdrawTransactioDetails.data.amount_sent)).toFixed(8);
                      console.log("User BCH balance In DB ::: "+userBCHBalanceInDb);
                      console.log("UpdateUser BCH balance ::: "+updatedBCHbalance);
                      console.log("User BCH usersellAmountBCH  ::: "+usersellAmountBCH);
                      console.log("Fee :: " +networkFeeByBCHServerForThisTransaction);
                      console.log("\nUser BTC balance In DB ::: "+userBTCBalanceInDb);
                      console.log("User BCH usersellAmountBTC  ::: "+usersellAmountBTC);
                      console.log("UpdateUser BTC balance ::: "+updatedBTCbalance);
                      User.update({
                          email: userEmailId
                        }, {
                          BTCbalance: parseFloat(updatedBTCbalance).toFixed(8),
                          BCHbalance: parseFloat(updatedBCHbalance).toFixed(8)
                        })
                        .exec(function(err, updatedUser) {
                          if (err) {
                            console.log("Error to udpate .....");
                            return res.json( {
                                    "message": "Error to update User Details",
                                    statusCode: 400
                            });
                          }
                          User.findOne({
                            email: userEmailId
                          }).populateAll().exec(function (err, user){
                            if (err) {
                              return res.json( {"message": "Error to find user",statusCode: 401});
                            }
                            if (!user) {
                              return res.json( {"message": "Invalid email!",statusCode: 401});
                            }
                             return  res.json({
                                  user: user,
                                  statusCode: 200
                                });
                          });
                        });
                    });
                  });
              });
          }
        });
      });
  },
  buyBCHCoinByUserWithFeeBlockIO: function(req, res, next) {
    console.log("Enter into buyBCHCoinByUserWithFeeBlockIO with ::: ");
    var userEmailId=req.body.userMailId;
    var userbuyAmountBTC=parseFloat(req.body.buyAmountBTC).toFixed(8);
    var userbuyAmountBCH=parseFloat(req.body.buyAmountBCH).toFixed(8);
    var userSpendingPassword=req.body.spendingPassword ;
    var userCommentForReceiver=req.body.commentForReciever;
    var userCommentForSender=req.body.commentForSender;
    var minimumAmountBCHToBuy=0.0001;
    minimumAmountBCHToBuy=parseFloat(minimumAmountBCHToBuy).toFixed(8);

    if(!userEmailId||!userbuyAmountBTC  ||!userbuyAmountBCH||!userSpendingPassword
      ||!userCommentForReceiver||!userCommentForSender){
          console.log("Invalid Parameter by user!!!");
          res.json({"message": "Invalid Parameter",  statusCode: 400  });
      }
    if (userbuyAmountBCH <= minimumAmountBCHToBuy) {
      console.log("BCH buy amount in not less 0.0001");
      return res.json( {"message": "Amount not less then 0.0001",statusCode: 400});
    }
    User.findOne({
        email: userEmailId
      })
      .exec(function(err, userDetails) {
        if (err) {
          console.log("Error to get User Details");
          return res.json( {"message": "Error to get user details",  statusCode: 400});
        }
        if(!userDetails){
          return res.json( {"message": "Invalid email Id",  statusCode: 400});
        }
        var userBTCBalanceInDb=parseFloat(userDetails.BTCbalance).toFixed(8);
        var userBCHBalanceInDb=parseFloat(userDetails.BCHbalance).toFixed(8);
        var userBTCAddressInDb=userDetails.userBTCAddress;
        var userBCHAddressInDb=userDetails.userBCHAddress;
        console.log("User BTC balance in database ::: " + userBTCBalanceInDb);
        console.log("User BTC amount send ::: " + userBTCBalanceInDb);

        if (userbuyAmountBTC > userBTCBalanceInDb) {
          console.log(" User have Insufficient fund in BTC Server !!!");
          return res.json( {"message": "You have Insufficient",statusCode: 400});
        }
        User.compareSpendingpassword(userSpendingPassword, userDetails, function(err, valid) {
          if (err) {
            console.log("Error to Compare SpendingPassword!!!");
            return res.json( {
                      "message": "Error to compare password",
                      statusCode: 400
              });
          }
          if (!valid) {
            console.log("Invalid SpendingPassword!!!");
            return res.json( {"message": "Pleae enter valid Spending Password",statusCode: 400});
          } else {
            console.log("User spendingpassword is valid ::");
            block_io.withdraw_from_addresses(
            {
              'amounts': userbuyAmountBTC,
              'from_addresses': userBTCAddressInDb,
              'to_addresses':  companyBTCAccountAddress,
              'pin': secreatePin
            },
            function (error, withdrawTransactioDetails) {
              if (error){
                console.log("Error from Block.io "+JSON.stringify(withdrawTransactioDetails));
                if(!withdrawTransactioDetails){
                  return res.json({"message": "Error to connect with BTC Server",statusCode: 400});
                }
                return res.json({"message": withdrawTransactioDetails.data.error_message,statusCode: 400});
              }
              var amountWithdrawnFromUserBTCAccount=withdrawTransactioDetails.data.amount_withdrawn;
              console.log("WithdrawTransactioDetails Amount: "+amountWithdrawnFromUserBTCAccount);
              var updatedBTCbalance = (parseFloat(userDetails.BTCbalance).toFixed(8) -
                                       parseFloat(amountWithdrawnFromUserBTCAccount).toFixed(8));
              var minimumNumberOfConfirmation=3;
              clientBCH.cmd('sendfrom',
                companyBCHAccount,
                userBCHAddressInDb,
                userbuyAmountBCH,
                minimumNumberOfConfirmation,
                companyBCHAccountAddress,
                companyBCHAccountAddress,
                function(err, TransactionDetails, resHeaders) {
                  if (err){
                        console.log("Error from sendFromBCHAccount:: ");
                        if(err.code && err.code== "ECONNREFUSED"){
                            return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
                        }
                        if(err.code && err.code== -5){
                            return res.json({"message":"Invalid BCH Address" ,statusCode: 400});
                        }
                        if(err.code && err.code== -6){
                            return res.json({"message":"Account has Insufficient funds" ,statusCode: 400});
                        }
                        if(err.code && err.code < 0){
                            return res.json({"message":"Problem in BCH server" ,statusCode: 400});
                        }
                        return res.json({"message":"Error in BCH Server",statusCode: 400});
                  }
                  console.log('Company BCH Sent Succesfully in UserBCHAddress txid: ', TransactionDetails);
                  clientBCH.cmd('gettransaction', TransactionDetails,
                    function(err, compleateTransactionDetails, resHeaders) {
                      if (err){

                            console.log("Error from gettransaction:: ");
                            if(err.code && err.code== "ECONNREFUSED"){
                                return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
                            }
                            if(err.code && err.code < 0){
                                return res.json({"message":"Problem in getTransaction BCH server" ,statusCode: 400});
                            }
                            return res.json({"message":"Error in BCH Server",statusCode: 400});
                      }
                      var networkFeeByBCHServerForThisTransaction = parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8);
                      var updatedBCHbalance = (parseFloat(userBCHBalanceInDb) + parseFloat(userbuyAmountBCH)).toFixed(8);
                      updatedBCHbalance = parseFloat(updatedBCHbalance).toFixed(8) -  parseFloat(networkFeeByBCHServerForThisTransaction).toFixed(8);
                      console.log("User BCH balance In DB ::: "+userBCHBalanceInDb);
                      console.log("User BTC balance In DB ::: "+userBTCBalanceInDb);
                      console.log("Amount Withdrawn From User BTC Account ::: "+amountWithdrawnFromUserBTCAccount);
                      console.log("User BCH userbuyAmountBCH  ::: "+userbuyAmountBCH);
                      console.log("Fee :: " +networkFeeByBCHServerForThisTransaction);
                      console.log("UpdateUser BCH balance ::: "+updatedBCHbalance);
                      console.log("UpdateUser BTC balance ::: "+updatedBTCbalance);
                      User.update({
                          email: userEmailId
                        }, {
                          BTCbalance: parseFloat(updatedBTCbalance).toFixed(8),
                          BCHbalance: parseFloat(updatedBCHbalance).toFixed(8)
                        })
                        .exec(function(err, updatedUser) {
                          if (err) {
                            res.json({
                              "message": "Error to update User",
                              statusCode: 400
                            });
                          }
                          User.findOne({
                            email: userEmailId
                          }).populateAll().exec(function (err, user){
                            if (err) {
                              return res.json( {"message": "Error to find user",statusCode: 401});
                            }
                            if (!user) {
                              return res.json( {"message": "Invalid email!",statusCode: 401});
                            }
                            console.log("Returned updated User!!! ");
                              return  res.json({user: user,statusCode: 200});
                          });
                        });
                    });
                });
            });
          }
        });
      });
  },
  getTransactionListBCH: function(req, res, next) {
    console.log("Enter into getTransactionListBCH::: ");
    var userMailId =req.body.userMailId;
    if(!userMailId){
      console.log("Invalid Parameter by user.....");
      return  res.json({"message": "Invalid Parameter",statusCode: 400});
    }
    User.findOne({
      email: userMailId
    }).exec(function (err, user){
      if (err) {
        console.log("Error to find user !!!");
        return res.json( {"message": "Error to find user",statusCode: 401});
      }
      if (!user) {
        console.log("Invalid Email !!!");
        return res.json( {"message": "Invalid email!",statusCode: 401});
      }
        clientBCH.cmd(
          'listtransactions',
          userMailId,
          function(err, transactionList) {
            if (err) {
                  console.log("Error from sendFromBCHAccount:: ");
                  if(err.code && err.code== "ECONNREFUSED"){
                      return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
                  }
                  if(err.code && err.code < 0){
                      return res.json({"message":"Problem in BCH server" ,statusCode: 400});
                  }
                  return res.json({"message":"Error in BCH Server",statusCode: 400});
            }
            console.log("Return transactionList List !! ");
            for(var i = 0; i < transactionList.length; i++) {
              console.log("transactionList.account ::"+transactionList[i].address);
              if(transactionList[i].comment == companyBCHAccountAddress){
                console.log("companyBCHAccountAddress found !!!");
                  delete transactionList[i];
              }
            }
            return res.json({"tx": transactionList,statusCode: 200});
        });
    });
  },
  getTransactionListAllBlockIO: function(req, res, next) {
    console.log("Enter into getTransactionListAllBlockIO::: " + JSON.stringify(req.body));
    var userMailId =req.body.userMailId;
    if(!userMailId){
      console.log("Invalid Parameter by user.....");
      return res.json({"message": "Invalid Parameter",statusCode: 400});
    }
    User.findOne({
      email: userMailId
    }).exec(function (usererr, user){
      if (usererr) {
        return res.json( {"message": "Error to find user",statusCode: 401});
      }
      if (!user) {
        return res.json( {"message": "Invalid email!",statusCode: 401});
      }
      var userBTCAddressInDB=user.userBTCAddress;
      block_io.get_transactions({'type': 'sent','addresses': userBTCAddressInDB},
      function(errsent, transactionDetailssent) {
        if (errsent){
          console.log("Error from Block.io "+JSON.stringify(transactionDetailssent));
          if(!transactionDetailssent){
            return res.json({"message": "Error to connect with BTC Server",statusCode: 400});
          }
          return res.json({"message": transactionDetailssent.data.error_message,statusCode: 400});
        }
        var transactionListOfBTCSent=transactionDetailssent.data.txs;
        block_io.get_transactions({'type': 'received',
        'addresses': userBTCAddressInDB
        },
        function(errrec, transactionDetailsreceived) {
          if (errrec){
            console.log("Error from Block.io "+JSON.stringify(transactionDetailsreceived));
            if(!transactionDetailsreceived){
              return res.json({"message": "Error to connect with BTC Server",statusCode: 400});
            }
            return res.json({"message": transactionDetailsreceived.data.error_message,statusCode: 400});
          }
          var transactionListOfBTCReceived=transactionDetailsreceived.data.txs;


          for(var i = 0; i < transactionListOfBTCSent.length; i++) {

            console.log("transactionListOfBTCSent.address ::"+JSON.stringify(transactionListOfBTCSent[i].amounts_sent[0].recipient));
            if(transactionListOfBTCSent[i].amounts_sent[0].recipient==companyBTCAccountAddress){
                delete transactionListOfBTCSent[i];
            }
          }

          for(var i = 0; i < transactionListOfBTCReceived.length; i++) {
            console.log("transactionListOfBTCReceived.address ::"+JSON.stringify(transactionListOfBTCReceived[i].senders));
            if(transactionListOfBTCReceived[i].senders==companyBTCAccountAddress){
                  delete transactionListOfBTCReceived[i];
            }
          }
          var transactionDetailsAll = mergeJSON.merge(transactionListOfBTCSent,transactionListOfBTCReceived);
          return res.json({ "tx": transactionDetailsAll, statusCode: 200});
        });
      });
    });
  },
  getCurrentBalanceBCH: function(req, res, next) {
    console.log("Enter into getCurrentBalanceBCH::: ");
    var userMailId =req.body.userMailId;
    if(!userMailId){
      console.log("Invalid Parameter by user.....");
      return res.json({"message": "Invalid Parameter",statusCode: 400});
    }
    User.findOne({
      email: userMailId
    }).populateAll().exec(function (err, user){
      if (err) {
        return res.json( {"message": "Error to find user",statusCode: 401});
      }
      if (!user) {
        return res.json( {"message": "Invalid email!",statusCode: 401});
      }
      console.log("Valid User :: "+userMailId);
      console.log("UserBCH Balance ::"+user.BCHbalance);
      var userBCHBalanceInDb = parseFloat(user.BCHbalance).toFixed(8);

      clientBCH.cmd(
        'getbalance',
        userMailId,
        function(err, userBCHBalanceFromServer, resHeaders) {
          if (err) {
              console.log("Error from sendFromBCHAccount:: ");
              if(err.code && err.code== "ECONNREFUSED"){
                  return res.json({"message":"BCH Server Refuse to connect App" ,statusCode: 400});
              }
              if(err.code && err.code== -5){
                  return res.json({"message":"Invalid BCH Address" ,statusCode: 400});
              }
              if(err.code && err.code== -6){
                  return res.json({"message":"Account has Insufficient funds" ,statusCode: 400});
              }
              if(err.code && err.code < 0){
                  return res.json({"message":"Problem in BCH server" ,statusCode: 400});
              }
              return res.json({"message":"Error in BCH Server",statusCode: 400});
          }
          console.log(parseFloat(userBCHBalanceFromServer).toFixed(8)+ " User current balance in server:: "+parseFloat(userBCHBalanceInDb).toFixed(8));
          if(parseFloat(userBCHBalanceFromServer).toFixed(8) > parseFloat(userBCHBalanceInDb).toFixed(8)){
            console.log("UserBalance Need to update ............");
            User.update({
                email: userMailId
              }, {
                BCHbalance: parseFloat(userBCHBalanceFromServer).toFixed(11)
              })
              .exec(function(err, updatedUser) {
                  if (err) {
                    return res.json({"message":"Error to update User balance" ,statusCode: 400});
                  }
                  User.findOne({
                    email: userMailId
                  }).populateAll().exec(function (err, user){
                    if (err) {
                      return res.json( {"message": "Error to find user",statusCode: 401});
                    }
                    if (!user) {
                      return res.json( {"message": "Invalid email!",statusCode: 401});
                    }
                    res.json({user: user,statusCode:200});
                  });
              });
          }else {
            res.json({"message": "No need to update",statusCode:201});
          }
        });
    });
  },
  getCurrentBalanceBTC: function(req, res, next) {
    console.log("Enter into getTransactioList::: " + JSON.stringify(req.body));
    if(!req.body.userMailId){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });

    }
    User
      .findOne({
        email: req.body.userMailId
      }).populateAll()
      .then(function(user) {
        console.log("User return "+JSON.stringify(user));
        console.log("UserBCH Balance ::"+user.BTCbalance);
        block_io.get_address_balance({'labels': req.body.userMailId},
        function (error, userBalanceDetais) {
          if(error){
            return res.json({
                    "message": userBalanceDetais,
                    statusCode: 500
            });
          }
          console.log("userBalanceDetais.data.available_balance ::: "+userBalanceDetais.data.available_balance);
          var userAvaliableBalanceBTC=userBalanceDetais.data.available_balance;
          if(parseFloat(userAvaliableBalanceBTC).toFixed(8)>parseFloat(user.BTCbalance).toFixed(8)){
            User.update({
                email: req.body.userMailId
              }, {
                BTCbalance: userAvaliableBalanceBTC
              })
              .exec(function(err, updatedUser) {
                if (err) {
                  return res.serverError(err);
                }
                User
                  .findOne({
                    email: req.body.userMailId
                  }).populateAll()
                  .then(function(userUpdated) {
                    console.log("User return "+JSON.stringify(userUpdated));
                    res.json({
                      user: userUpdated,
                      statusCode:200
                    });
                  })
                  .catch(function(err) {
                    if (err) return res.serverError(err);
                  });
              });
          }else {
            res.json({
              "message": "No need to update",
              statusCode:201
            });
          }
          // return res.json(200, {
          //         "data": userBalanceDetais.data,
          //         statusCode: 200
          // });
        });
      })
      .catch(function(err) {
        console.log("Error to find user ........");
        if(err){
        return res.json( {
                "message": "User Details not found",
                statusCode: 400
        });
        }
      });
  },
  sendEmail: function(req, res, next) {
    console.log("Enter into sendEmailTest::: " + JSON.stringify(req.body));
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'wallet.bcc@gmail.com',
        pass: 'boosters@123'
      }
    });
    var mailOptions = {
      from: 'wallet.bcc@gmail.com',
      to: 'bccwalletsuport@gmail.com',
      subject: 'Sending Email using Node.js',
      text: 'That was easy!'
    };
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
        res.json(200,"Message Send Succesfully");
      }
    });
  },
  getCurrntPriceOfBTC: function(req, res, next) {
    console.log("Enter into getCurrntPriceOfBTCTest");

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
          return  res.json( {
            "message": "Error to get current BCH Price",
            statusCode: 401
          });
        }else{
          console.log("Returning Current price of BCH ");
          return  res.json( {
            "currentPrice": body,
            statusCode: 200
          });
        }


      });
  },
  getChart: function(req, res, next) {

    console.log("Enter Into getChart!!! "+JSON.stringify(request.body));
      var lastHours=req.body.lastHours;
      var maxRespArrSize=req.body.maxRespArrSize;
      console.log(lastHours);
      console.log(lastHours);
      if(!lastHours || !maxRespArrSize){
        return  res.json( {
          "message": "Invalid Parameter",
          statusCode: 401
        });
      }
      var options = { method: 'POST',
        url: 'https://cex.io/api/price_stats/BCH/BTC',
        headers:
         { accept: '*/*',
           'content-type': 'application/json',
           'accept-language': 'en-US,en;q=0.8' },
        body:
         {
           "lastHours": lastHours,
           "maxRespArrSize": maxRespArrSize
         },
        json: true
      };
      request(options, function (error, response, body) {
        if (error) throw new Error(error);
        var arrayObjectTimeStamp =[];
        var arrayObject =[];
            for (var i = 0; i < body.length; i++) {
              console.log(JSON.stringify(body[1]));
              var date =new Date(body[i].tmsp*1000)
              var hours = date.getHours();
              var minutes = "0" + date.getMinutes();
              var seconds = "0" + date.getSeconds();
              var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
              arrayObjectTimeStamp.push(formattedTime);
              arrayObject.push(parseFloat(body[i].price));
            }
            return res.send({"timeStamp":arrayObjectTimeStamp,"rate":arrayObject});
      });
  },
  sentOtpToEmailForgotPassword: function(req, res, next){

  	console.log("Enter into sentOtpToEmail");
  	var userMailId=req.body.userMailId;
  	if(!userMailId){
  		console.log("Invalid Parameter by user.....");
  		return res.json({"message": "Invalid Parameter",statusCode: 400});
  	}
  	User.findOne({
  		email: userMailId
  	}).exec(function (err, user){
  		if (err) {
  			return res.json( {"message": "Error to find user",statusCode: 401});
  		}
  		if (!user) {
  			return res.json( {"message": "Invalid email!",statusCode: 401});
  		}
  		var transporter = nodemailer.createTransport({
  			service: 'gmail',
  			auth: {
  				user: 'wallet.bcc@gmail.com',
  				pass: 'boosters@123'
  			}
  		});
  		var newCreatedPassword=Math.floor(100000 + Math.random() * 900000);
  		console.log("newCreatedPassword :: "+newCreatedPassword);
  		var mailOptions = {
  			from: 'wallet.bcc@gmail.com',
  			to: userMailId,
  			subject: 'Please reset your password',
  			text: 'We heard that you lost your BccPay password. Sorry about that! '+
  			'\n But don’t worry! You can use this otp reset your password '+newCreatedPassword
  		};
  		transporter.sendMail(mailOptions, function(error, info){
  			if (error) {
  				console.log(error);
  			} else {
  				console.log(newCreatedPassword+'Email sent: ' + info.response);
  				//res.json(200,"Message Send Succesfully");
  				console.log("createing encryptedPassword ....");
  				bcrypt.hash(newCreatedPassword.toString(), 10, function (err, hash) {
  					if(err) return next(err);
  					var newEncryptedPass = hash;
  					User.update({
  							email: userMailId
  						}, {
  							encryptedForgotPasswordOTP: newEncryptedPass
  						})
  						.exec(function(err, updatedUser) {
  							if (err) {
  								return res.serverError(err);
  							}
  							console.log("OTP forgot update succesfully!!!");
  							return res.json({
  												"message": "Otp sent on user mail id",
                          "userMailId":userMailId,
  												statusCode: 200
  								});
  						});
  				});
  			}
  		});
  	});
  },
  verifyOtpToEmailForgotPassord: function(req, res, next){

    	console.log("Enter into sentOtpToEmail");
    	var userMailId=req.body.userMailId;
      var otp=req.body.otp;
    	if(!userMailId ||!otp){
    		console.log("Invalid Parameter by user.....");
    		return res.json({"message": "Invalid Parameter",statusCode: 400});
    	}
    	User.findOne({
    		email: userMailId
    	}).exec(function (err, user){
    		if (err) {
    			return res.json( {"message": "Error to find user",statusCode: 401});
    		}
    		if (!user) {
    			return res.json( {"message": "Invalid email!",statusCode: 401});
    		}
        User.compareForgotpasswordOTP(otp, user, function(err, valid) {
          if (err) {
            console.log("Error to compare otp");
            return  res.json({"message": "Error to compare otp",statusCode: 401});
          }
          if (!valid) {
            return  res.json( {"message": "Please enter correct otp",statusCode: 401});
          }else{
            console.log("OTP is varified succesfully");
            res.json(200,{
              "message":"OTP is varified succesfully",
              "userMailId":userMailId,
              statusCode: 200
            });
          }
        });
    	});
  },
  updateForgotPassordAfterVerify: function(req, res, next){
      	console.log("Enter into sentOtpToEmail");
      	var userMailId=req.body.userMailId;
        var newPassword=req.body.newPassword;
        var confirmNewPassword=req.body.confirmNewPassword;
      	if(!userMailId ||!newPassword ||!confirmNewPassword){
      		console.log("Invalid Parameter by user.....");
      		return res.json({"message": "Invalid Parameter",statusCode: 401});
      	}
        if(newPassword!=confirmNewPassword){
          console.log("Invalid Parameter by user.....");
      		return res.json({"message": "New Password and Confirm New Password not match",statusCode: 401});
        }
      	User.findOne({
      		email: userMailId
      	}).exec(function (err, user){
      		if (err) {
      			return res.json( {"message": "Error to find user",statusCode: 401});
      		}
      		if (!user) {
      			return res.json( {"message": "Invalid email!",statusCode: 401});
      		}
          bcrypt.hash(confirmNewPassword, 10, function (err, hash) {
            if(err) res.json( {"message": "Errot to bcrypt passoword",statusCode: 401});
            var newEncryptedPass = hash;
            User.update({
                email: userMailId
              }, {
                encryptedPassword: newEncryptedPass
              })
              .exec(function(err, updatedUser) {
                if (err) {
                  return res.json( {"message": "Error to update passoword!",statusCode: 401});
                }
                console.log("Update passoword succesfully!!!");
                return res.json({
                          "message": "Your passoword updated succesfully",
                          statusCode: 200
                  });
              });
          });
      	});
  },
  updateCurrentPassword: function(req, res, next){
        	console.log("Enter into updateCurrentPassword");
        	var userMailId=req.body.userMailId;
          var currentPassword=req.body.currentPassword;
          var newPassword=req.body.newPassword;
          var confirmNewPassword=req.body.confirmNewPassword;
        	if(!userMailId ||!currentPassword ||!newPassword ||!confirmNewPassword){
        		console.log("Invalid Parameter by user.....");
        		return res.json({"message": "Invalid Parameter",statusCode: 401});
        	}
          if(currentPassword==newPassword){
            console.log("Invalid Parameter by user.....");
            return res.json({"message": "Current password is not same as newPassword",statusCode: 401});
          }
          if(newPassword!=confirmNewPassword){
            console.log("Invalid Parameter by user.....");
        		return res.json({"message": "New Password and Confirm New Password not match",statusCode: 401});
          }
        	User.findOne({
        		email: userMailId
        	}).exec(function (err, user){
        		if (err) {
        			return res.json( {"message": "Error to find user",statusCode: 401});
        		}
        		if (!user) {
        			return res.json( {"message": "Invalid email!",statusCode: 401});
        		}
            User.comparePassword(currentPassword, user, function(err, valid) {
              if (err) {
                console.log("Error to compare password");
                return  res.json({"message": "Error to compare password",statusCode: 401});
              }
              if (!valid) {
                return  res.json( {"message": "Please enter correct currentPassword",statusCode: 401});
              }else{
                  bcrypt.hash(confirmNewPassword, 10, function (err, hash) {
                    if(err) res.json( {"message": "Errot to bcrypt passoword",statusCode: 401});
                    var newEncryptedPass = hash;
                    User.update({
                        email: userMailId
                      }, {
                        encryptedPassword: newEncryptedPass
                      })
                      .exec(function(err, updatedUser) {
                        if (err) {
                          return res.json( {"message": "Error to update passoword!",statusCode: 401});
                        }
                        console.log("Update current passoword succesfully!!!");
                        return res.json({
                                  "message": "Your passoword updated succesfully",
                                  statusCode: 200
                          });
                      });
                  });
              }
            });

        	});
  },
  sentOtpToUpdateSpendingPassword: function(req, res, next){
    console.log("Enter into sentOtpToEmail");
    var userMailId=req.body.userMailId;
    var currentPassword=req.body.currentPassword;
    if(!userMailId ||!currentPassword){
      console.log("Invalid Parameter by user.....");
      return res.json({"message": "Invalid Parameter",statusCode: 400});
    }
    User.findOne({
      email: userMailId
    }).exec(function (err, user){
      if (err) {
        return res.json( {"message": "Error to find user",statusCode: 401});
      }
      if (!user) {
        return res.json( {"message": "Invalid email!",statusCode: 401});
      }
      User.comparePassword(currentPassword, user, function(err, valid) {
        if (err) {
          console.log("Error to compare password");
          return  res.json({"message": "Error to compare password",statusCode: 401});
        }
        if (!valid) {
          return  res.json( {"message": "Please enter correct Password",statusCode: 401});
        }else{
          var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'wallet.bcc@gmail.com',
              pass: 'boosters@123'
            }
          });
          var newCreatedPassword=Math.floor(100000 + Math.random() * 900000);
          console.log("newCreatedPassword :: "+newCreatedPassword);
          var mailOptions = {
            from: 'wallet.bcc@gmail.com',
            to: userMailId,
            subject: 'Please reset your spending password',
            text: 'We heard that you lost your BccPay spending password. Sorry about that! '+
            '\n But don’t worry! You can use this otp reset your password '+newCreatedPassword
          };
          transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log(newCreatedPassword+'Email sent: ' + info.response);
              //res.json(200,"Message Send Succesfully");
              console.log("createing encryptedPassword ....");
              bcrypt.hash(newCreatedPassword.toString(), 10, function (err, hash) {
                if(err) return next(err);
                var newEncryptedPass = hash;
                User.update({
                    email: userMailId
                  },{
                    encryptedForgotSpendingPasswordOTP: newEncryptedPass
                  })
                  .exec(function(err, updatedUser) {
                    if (err) {
                      return res.serverError(err);
                    }
                    console.log("OTP forgot update succesfully!!!");
                    return res.json({
                              "message": "Otp sent on user mail id",
                              "userMailId":userMailId,
                              statusCode: 200
                      });
                  });
              });
            }
          });
        }
      });

    });
  },
  verifyOtpToEmailForgotSpendingPassord: function(req, res, next){

    	console.log("Enter into sentOtpToEmail");
    	var userMailId=req.body.userMailId;
      var otp=req.body.otp;
    	if(!userMailId ||!otp){
    		console.log("Invalid Parameter by user.....");
    		return res.json({"message": "Invalid Parameter",statusCode: 400});
    	}
    	User.findOne({
    		email: userMailId
    	}).exec(function (err, user){
    		if (err) {
    			return res.json( {"message": "Error to find user",statusCode: 401});
    		}
    		if (!user) {
    			return res.json( {"message": "Invalid email!",statusCode: 401});
    		}
        User.compareEmailVerificationOTPForSpendingPassword(otp, user, function(err, valid) {
          if (err) {
            console.log("Error to compare otp");
            return  res.json({"message": "Error to compare otp",statusCode: 401});
          }
          if (!valid) {
            return  res.json( {"message": "Please enter correct otp",statusCode: 401});
          }else{
            console.log("OTP is varified succesfully");
            res.json(200,{
              "message":"OTP for spending passoword is varified succesfully",
              "userMailId":userMailId,
              statusCode: 200
            });
          }
        });
    	});
  },
  updateForgotSpendingPassordAfterVerify: function(req, res, next){
      	console.log("Enter into updateForgotSpendingPassordAfterVerif");
      	var userMailId=req.body.userMailId;
        var newSpendingPassword=req.body.newSpendingPassword;
        var confirmSpendingPassword=req.body.confirmSpendingPassword;
      	if(!userMailId ||!newSpendingPassword ||!confirmSpendingPassword){
      		console.log("Invalid Parameter by user.....");
      		return res.json({"message": "Invalid Parameter",statusCode: 401});
      	}
        if(newSpendingPassword!=confirmSpendingPassword){
          console.log("New Password and Confirm New Password not match");
      		return res.json({"message": "New Spending Password and Confirm Spending Password not match",statusCode: 401});
        }
      	User.findOne({
      		email: userMailId
      	}).exec(function (err, user){
      		if (err) {
      			return res.json( {"message": "Error to find user",statusCode: 401});
      		}
      		if (!user) {
      			return res.json( {"message": "Invalid email!",statusCode: 401});
      		}
          bcrypt.hash(newSpendingPassword, 10, function (err, hash) {
            if(err) res.json( {"message": "Errot to bcrypt passoword",statusCode: 401});
            var newEncryptedPass = hash;
            User.update({
                email: userMailId
              }, {
                encryptedSpendingpassword: newEncryptedPass
              })
              .exec(function(err, updatedUser) {
                if (err) {
                  return res.json( {"message": "Error to update passoword!",statusCode: 401});
                }
                console.log("Update passoword succesfully!!!");
                return res.json({
                          "message": "Your spending passoword updated succesfully",
                          statusCode: 200
                  });
              });
          });
      	});
  },
  sentOtpToEmailVerificatation: function(req, res, next){

    	console.log("Enter into sentOtpToEmailVerificatation");
    	var userMailId=req.body.userMailId;
    	if(!userMailId){
    		console.log("Invalid Parameter by user.....");
    		return res.json({"message": "Invalid Parameter",statusCode: 400});
    	}
    	User.findOne({
    		email: userMailId
    	}).exec(function (err, user){
    		if (err) {
    			return res.json( {"message": "Error to find user",statusCode: 401});
    		}
    		if (!user) {
    			return res.json( {"message": "Invalid email!",statusCode: 401});
    		}
    		var createNewOTP=Math.floor(100000 + Math.random() * 900000);
    		console.log("createNewOTP :: "+createNewOTP);
    		var mailOptions = {
    			from: 'wallet.bcc@gmail.com',
    			to: user.email,
    			subject: 'Please verify your email',
    			text: 'Your otp to varify email '+createNewOTP
    		};
    		transporter.sendMail(mailOptions, function(error, info){
    			if (error) {
    				console.log(error);
    			} else {
    				console.log(createNewOTP+'Email sent: ' + info.response);
    				console.log("createing encryptedPassword ....");
    				bcrypt.hash(createNewOTP.toString(), 10, function (err, hash) {
    					if(err) return next(err);
    					var newEncryptedPass = hash;
    					User.update({
    							email: userMailId
    						}, {
    							encryptedEmailVerificationOTP: newEncryptedPass
    						})
    						.exec(function(err, updatedUser) {
    							if (err) {
    								return res.serverError(err);
    							}
    							console.log("OTP  update encryptedEmailVerificationOTP succesfully!!!");
    							return res.json({
    												"message": "Otp sent on mail id",
    												statusCode: 200
    								});
    						});
    				});
    			}
    		});
    	});
  },
  updateUserVerifyEmail: function(req, res, next){

    	console.log("Enter into updateUserVerifyEmail");
    	var userMailId=req.body.userMailId;
      var otp=req.body.otp;
    	if(!userMailId ||!otp){
    		console.log("Invalid Parameter by user.....");
    		return res.json({"message": "Invalid Parameter",statusCode: 400});
    	}
    	User.findOne({
    		email: userMailId
    	}).exec(function (err, user){
    		if (err) {
    			return res.json( {"message": "Error to find user",statusCode: 401});
    		}
    		if (!user) {
    			return res.json( {"message": "Invalid email!",statusCode: 401});
    		}
        User.compareEmailVerificationOTP(otp, user, function(err, valid) {
          if (err) {
            console.log("Error to compare otp");
            return  res.json({"message": "Error to compare otp",statusCode: 401});
          }
          if (!valid) {
            return  res.json( {"message": "Please enter correct otp",statusCode: 401});
          }else{
            console.log("OTP is varified succesfully");
            User.update({
                email: userMailId
              }, {
                verifyEmail: true
              })
              .exec(function(err, updatedUser) {
                if (err) {
                  return res.json( {"message": "Error to update passoword!",statusCode: 401});
                }
                console.log("Update current SpendingPassword succesfully!!!");

                User.findOne({
                  email: userMailId
                }).exec(function (err, userDetailsReturn){
                  if (err) {
                    return res.json( {"message": "Error to find user",statusCode: 401});
                  }
                  if (!userDetailsReturn) {
                    return res.json( {"message": "Invalid email!",statusCode: 401});
                  }
                  return res.json(200, {
  										user: userDetailsReturn,
  										statusCode: 200
  								});
                });
              });
          }
        });
    	});
  }
};
