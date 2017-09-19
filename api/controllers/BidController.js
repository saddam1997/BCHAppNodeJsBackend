/**
 * BidController
 *
 * @description :: Server-side logic for managing bids
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

	addBid: function(req, res) {
		console.log("Enter into bid api addBid :: "+JSON.stringify(req.body));
		var userBidAmountBTC=parseFloat(req.body.bidAmountBTC).toFixed(8);
		var userBidAmountBCH=parseFloat(req.body.bidAmountBCH).toFixed(8);
		var userBidRate=parseFloat(req.body.bidRate).toFixed(8);
		var userBidownerId=req.body.bidownerId;
		var userSpendingPassword=req.body.spendingPassword;
		var currentBidrateOfServer=parseFloat(req.body.currentBidRateOfServer).toFixed(8);
		var minimumAmountToApplyForBid=0.01;
		var minimumBidCanApplyByUser=parseFloat(currentBidrateOfServer).toFixed(8)-parseFloat(minimumAmountToApplyForBid).toFixed(8);
		// var currentBidrateOfServer=330000;
		// var minimumBidCanApplyByUser=324000;

		if(!userBidAmountBCH ||!userBidAmountBTC ||!userSpendingPassword ||
			 !userBidRate || !userBidownerId || !currentBidrateOfServer){
			console.log("User Entered invalid parameter !!!");
			return  res.json({
				"message": "Invalid Parameter",
				statusCode: 400
			});
		}
		if(minimumBidCanApplyByUser >= userBidRate){
			return res.json(
				{
					"message": "Minimum Bidrate is "+minimumBidCanApplyByUser+" !",
					statusCode: 401
				}
			);
		}
		if (userBidAmountBTC < 0.0001) {
			return res.json(
				{
					"message": "Minimum bid amount is not less then 0.0001",
					statusCode: 401
				});
		}
		User.findOne({
			id: userBidownerId
		}).exec(function (errToFindUser, user){

			if (errToFindUser) {
				return res.json( {"message": "Error to find user",statusCode: 401});
			}
			if (!user) {
				return res.json( {"message": "Invalid UserId!!",statusCode: 401});
			}
			var userBTCBalanceInDb = parseFloat(user.BTCbalance).toFixed(8);
			var userFreezedBTCBalanceInDb = parseFloat(user.FreezedBTCbalance).toFixed(8);
			var userIdInDb = parseFloat(user.id).toFixed(8);

			if (userBTCBalanceInDb <= 0.0001) {
				return res.json(
					{
						"message": "You need to have minimum BTC Balance 0.0001",
						statusCode: 401
					});
			}
			if (userBidAmountBTC >= userBTCBalanceInDb) {
				return res.json(
					{
						"message": "You have insufficient BTC Balance",
						statusCode: 401
					});
			}
			User.compareSpendingpassword(userSpendingPassword, user,
			function(err, valid) {
				if (err) {
					console.log("Eror To compare password !!!");
					return res.json({"message": err,statusCode: 401});
				}
				if (!valid) {
					console.log("Invalid spendingpassword !!!");
					return res.json( {"message": 'Enter valid spending password',statusCode: 401 });
				}else{
					console.log("Valid spending password !!!");
					Bid.create({
					  bidAmountBTC: userBidAmountBTC,
					  bidAmountBCH: userBidAmountBCH,
						bidRate: parseFloat(userBidRate).toFixed(8),
					  bidowner: userIdInDb
					})
					.exec(function(err, bidDetails) {
							if(err){
								console.log("Error to Create Bid !!!");
								return  res.json({
									"message": "Error to create Bid",
									statusCode: 400
								});
							}
							var updateUserBTCBalance=parseFloat(userBTCBalanceInDb).toFixed(8)-parseFloat(userBidAmountBTC).toFixed(8);
							var updateFreezedBalance=(parseFloat(userFreezedBTCBalanceInDb)+parseFloat(userBidAmountBTC)).toFixed(8);
							User.update(
								{
									id:userIdInDb
								},
								{
									FreezedBTCbalance:updateFreezedBalance,
									BTCbalance:updateUserBTCBalance,
								}
							)
							.exec(function(err, updated){
									if(err){
										console.log("Error to update UserBid details !!!");
										return  res.json({
											"message": "Error to update UserBid details !!!",
											statusCode: 400
										});
									}
									User.findOne({
										id: userIdInDb
									})
									.populateAll()
									.exec(function (err, userDetailsReturn){
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
					});
				}
			});

		});
	},
	removeBid: function(req, res) {
		console.log("Enter into bid api removeBid :: ");
		var userBidId=req.body.bidId;
		var bidownerId=req.body.bidownerId;

		if(!userBidId ||!bidownerId){
			console.log("User Entered invalid parameter !!!");
			return  res.json({
				"message": "Invalid Parameter",
				statusCode: 400
			});
		}
		Bid.findOne({
			bidowner:bidownerId,
			id:userBidId
		}).exec(function (err, bidDetails){
			if (err) {
				return  res.json({
					"message": "Error to find bid",
					statusCode: 400
				});
			}
			if(!bidDetails){
				return  res.json({
					"message": "No Bid found for this user",
					statusCode: 400
				});
			}
			console.log("Valid bid details !!!"+JSON.stringify(bidDetails));


			User.findOne({
				id:bidownerId
			}).exec(function (err, user){
				if (err) {
					return res.json( {"message": "Error to find user",statusCode: 401});
				}
				if (!user) {
					return res.json( {"message": "Invalid email!",statusCode: 401});
				}

				var userBTCBalanceInDb = parseFloat(user.BTCbalance).toFixed(8);
				var bidAmountOfBTCInBidTableDB=parseFloat(bidDetails.bidAmountBTC).toFixed(8);
				var userFreezedBTCbalanceInDB=parseFloat(user.FreezedBTCbalance).toFixed(8);
				var updateFreezedBalance = userFreezedBTCbalanceInDB-bidAmountOfBTCInBidTableDB;
				var updateUserBTCBalance = (parseFloat(userBTCBalanceInDb)+parseFloat(bidAmountOfBTCInBidTableDB)).toFixed(8);
				console.log("userBTCBalanceInDb :"+userBTCBalanceInDb);
				console.log("bidAmountOfBTCInBidTableDB :"+bidAmountOfBTCInBidTableDB);
				console.log("userFreezedBTCbalanceInDB :"+userFreezedBTCbalanceInDB);
				console.log("updateFreezedBalance :"+updateFreezedBalance);
				console.log("updateUserBTCBalance :"+updateUserBTCBalance);

				User.update({
							id:bidownerId
					},{
						BTCbalance: parseFloat(updateUserBTCBalance).toFixed(8),
						FreezedBTCbalance: parseFloat(updateFreezedBalance).toFixed(8)
					})
					.exec(function(err, updatedUser) {
						if (err) {
							console.log("Error to update user BTC balance");
							return res.json( {"message": "Error to update User values",statusCode: 400});
						}
						console.log("Removing bid !!!");
						Bid.destroy({
							id: userBidId
						}).exec(function (err){
							if (err) {
								return  res.json({
									"message": "Error to remove bid",
									statusCode: 400
								});
							}
						console.log("Returning user details !!!");
							User.findOne({
								id:bidownerId
							})
							.populateAll()
							.exec(function (err, userDetailsReturn){
								if (err) {
									return res.json( {"message": "Error to find user",statusCode: 401});
								}
								if (!userDetailsReturn) {
									return res.json( {"message": "Invalid Id!",statusCode: 401});
								}
								return res.json(200, {
										user: userDetailsReturn,
										statusCode: 200
								});
							});
						});
					});
			});
		});
	},
	getBid: function(req, res) {
		console.log("Enter into bid api getBid :: ");
		var userBidownerId=req.body.bidownerId;
		var userBidId=req.body.bidId;

		if(!userBidId ||!userBidownerId){
			console.log("User Entered invalid parameter !!!");
			return  res.json({
				"message": "Invalid Parameter",
				statusCode: 400
			});
		}
		User.findOne({
			id: userBidownerId
		})
		.populate("bids",{id: userBidId})
		.exec(function (err, userDetailsReturn){
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

	},
};
