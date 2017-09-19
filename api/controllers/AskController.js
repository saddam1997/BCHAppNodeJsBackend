/**
 * AskController
 *
 * @description :: Server-side logic for managing asks
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

	addAsk: function(req, res) {

		console.log("Enter into ask api addAsk :: "+JSON.stringify(req.body));
		var userAskAmountBTC=parseFloat(req.body.askAmountBTC).toFixed(8);
		var userAskAmountBCH=parseFloat(req.body.askAmountBCH).toFixed(8);
		var userAskRate=parseFloat(req.body.askRate).toFixed(8);
		var userAskownerId=req.body.askownerId;
		var userSpendingPassword=req.body.spendingPassword;
		var currentAskrateOfServer=parseFloat(req.body.currentAskrateOfServer).toFixed(8);
		var minimumAmountToApplyForAsk=0.01;
		var minimumAskCanApplyByUser=(parseFloat(currentAskrateOfServer)+parseFloat(minimumAmountToApplyForAsk)).toFixed(8);
		if(!userAskAmountBCH ||!userAskAmountBTC ||!userSpendingPassword ||
			 !userAskRate || !userAskownerId || !currentAskrateOfServer){
			console.log("User Entered invalid parameter !!!");
			return  res.json({
				"message": "Invalid Parameter",
				statusCode: 400
			});
		}
		console.log("currentAskrateOfServer :: "+currentAskrateOfServer);
		console.log("userAskRate :: "+userAskRate);
		console.log("minimumAskCanApplyByUser :: "+minimumAskCanApplyByUser);
		if(minimumAskCanApplyByUser < userAskRate){
			return res.json(
				{
					"message": "Minimum Askrate is "+minimumAskCanApplyByUser+" !",
					statusCode: 401
				}
			);
		}
		if (userAskAmountBCH < 0.0001) {
			return res.json({
					"message": "Minimum ask amount is not less then 0.0001",
					statusCode: 401
				});
		}

		User.findOne({
			id: userAskownerId
		}).exec(function (errToFindUser, user){

			if (errToFindUser) {
				return res.json( {"message": "Error to find user",statusCode: 401});
			}
			if (!user) {
				return res.json( {"message": "Invalid UserId!!",statusCode: 401});
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
				} else {
					console.log("Valid spending password !!!");
					console.log("Getting user details !!!");
					var userBCHBalanceInDb = parseFloat(user.BCHbalance).toFixed(8);
					var userFreezedBCHBalanceInDb = parseFloat(user.FreezedBCHbalance).toFixed(8);
					var userIdInDb = parseFloat(user.id).toFixed(8);
					if (userBCHBalanceInDb < 0.0001) {
						return res.json(
							{
								"message": "You need to have minimum BCH Balance 0.0001",
								statusCode: 401
							});
					}
					if (userAskAmountBCH >= userBCHBalanceInDb) {
						return res.json(
							{
								"message": "You have insufficient BCH Balance",
								statusCode: 401
							});
					}
					Ask.create({
						askAmountBTC: userAskAmountBTC,
						askAmountBCH: userAskAmountBCH,
						askRate: parseFloat(userAskRate).toFixed(8),
						askowner: userIdInDb
					})
					.exec(function(err, askDetails) {
							if(err){
								console.log("Error to Create Ask !!!");
								return  res.json({
									"message": "Error to create Ask",
									statusCode: 400
								});
							}
							var updateUserBCHBalance=parseFloat(userBCHBalanceInDb).toFixed(8)-parseFloat(userAskAmountBCH).toFixed(8);
							var updateFreezedBCHBalance=(parseFloat(userFreezedBCHBalanceInDb)+parseFloat(userAskAmountBCH)).toFixed(8);
							User.update(
								{
									id:userIdInDb
								},
								{
									FreezedBCHbalance:updateFreezedBCHBalance,
									BCHbalance:updateUserBCHBalance,
								}
							)
							.exec(function(err, updated){
									if(err){
										console.log("Error to update Userask details !!!");
										return  res.json({
											"message": "Error to update Userask details !!!",
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
	removeAsk: function(req, res) {
		console.log("Enter into ask api removeAsk :: ");
		var userAskId=req.body.askId;
		var askownerId=req.body.askownerId;

		if(!userAskId ||!askownerId){
			console.log("User Entered invalid parameter !!!");
			return  res.json({
				"message": "Invalid Parameter",
				statusCode: 400
			});
		}
		Ask.findOne({
			askowner:askownerId,
			id:userAskId
		}).exec(function (err, askDetails){
			if (err) {
				return  res.json({
					"message": "Error to find ask",
					statusCode: 400
				});
			}
			if(!askDetails){
				return  res.json({
					"message": "No ask found for this user",
					statusCode: 400
				});
			}
			console.log("Valid ask details !!!"+JSON.stringify(askDetails));

			User.findOne({
				id:askownerId
			}).exec(function (err, user){
				if (err) {
					return res.json( {"message": "Error to find user",statusCode: 401});
				}
				if (!user) {
					return res.json( {"message": "Invalid email!",statusCode: 401});
				}

				var userBCHBalanceInDb = parseFloat(user.BCHbalance).toFixed(8);
				var askAmountOfBCHInAskTableDB=parseFloat(askDetails.askAmountBCH).toFixed(8);
				var userFreezedBCHbalanceInDB=parseFloat(user.FreezedBCHbalance).toFixed(8);
				console.log("userBCHBalanceInDb :"+userBCHBalanceInDb);
				console.log("askAmountOfBCHInAskTableDB :"+askAmountOfBCHInAskTableDB);
				console.log("userFreezedBCHbalanceInDB :"+userFreezedBCHbalanceInDB);

				var updateFreezedBCHBalance = userFreezedBCHbalanceInDB-askAmountOfBCHInAskTableDB;
				var updateUserBCHBalance = (parseFloat(userBCHBalanceInDb)+parseFloat(askAmountOfBCHInAskTableDB)).toFixed(8);


				// console.log("updateFreezedBCHBalance :"+updateFreezedBCHBalance);
				// console.log("updateUserBCHBalance :"+updateUserBCHBalance);

				User.update({
							id:askownerId
					},{
						BCHbalance: parseFloat(updateUserBCHBalance).toFixed(8),
						FreezedBCHbalance: parseFloat(updateFreezedBCHBalance).toFixed(8)
					})
					.exec(function(err, updatedUser) {
						if (err) {
							console.log("Error to update user BTC balance");
							return res.json( {"message": "Error to update User values",statusCode: 400});
						}
						console.log("Removing ask !!!");
						Ask.destroy({
							id: userAskId
						}).exec(function (err){
							if (err) {
								return  res.json({
									"message": "Error to remove ask",
									statusCode: 400
								});
							}
						console.log("Returning user details !!!");
							User.findOne({
								id:askownerId
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
	}
};
