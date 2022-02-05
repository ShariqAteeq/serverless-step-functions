"use strict";

const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const StepFunction = new AWS.StepFunctions();

const isBookAvailable = (book, quantity) => {
  return book.quantity - quantity > 0;
};

module.exports.checkInventory = async (event) => {
  const { bookId, quantity } = event;

  try {
    const bookRes = await dynamodb
      .get({ TableName: "stepfunction-books", Key: { bookId } })
      .promise();
    const book = bookRes.Item;

    if (isBookAvailable(book, quantity)) {
      return book;
    } else {
      let bookOutOfStockError = new Error("The Book is out of stock");
      bookOutOfStockError.name = "BookOutOfStock";
      throw bookOutOfStockError;
    }
  } catch (error) {
    if (error.name === "BookOutOfStock") {
      throw error;
    } else {
      let bookNotFoundError = new Error("The Book is not found");
      bookNotFoundError.name = "BookNotFound";
      throw bookNotFoundError;
    }
  }
};
module.exports.calculateTotal = async ({ book, quantity }) => {
  let total = book.price * quantity;
  return { total };
};

const deductPoints = async (userId) => {
  await dynamodb
    .update({
      TableName: "stepfunction-users",
      Key: { userId },
      UpdateExpression: "SET points = :zero",
      ExpressionAttributeValues: {
        ":zero": 0,
      },
    })
    .promise();
};

module.exports.redeemPoints = async ({ userId, total }) => {
  try {
    let orderTotal = total.total;
    const userRes = await dynamodb
      .get({ TableName: "stepfunction-users", Key: { userId } })
      .promise();
    const user = userRes.Item;

    const points = user.points;
    if (orderTotal > points) {
      await deductPoints(userId);
      return { total: orderTotal, points };
    } else {
      throw new Error("Order total is less than redeem points");
    }
  } catch (error) {
    throw new Error(error);
  }
};
module.exports.billCustomer = async (params) => {
  return "Successfully Billed!";
};
module.exports.restoreRedeemPoints = async ({ userId, total }) => {
  console.log("total", total);

  try {
    if (total.points) {
      await dynamodb
        .update({
          TableName: "stepfunction-users",
          Key: { userId },
          UpdateExpression: "SET points = :points",
          ExpressionAttributeValues: {
            ":points": total.points,
          },
        })
        .promise();
    }
  } catch (error) {
    throw new Error(error);
  }
};

const updateBookQuantity = async (bookId, orderQuantity) => {
  console.log("bookId: ", bookId);
  console.log("orderQuantity: ", orderQuantity);
  let params = {
      TableName: 'bookTable',
      Key: { 'bookId': bookId },
      UpdateExpression: 'SET quantity = quantity - :orderQuantity',
      ExpressionAttributeValues: {
          ':orderQuantity': orderQuantity
      }
  };
  await dynamodb.update(params).promise();
}

module.exports.sqsWorker = async (event) => {
  try {
      console.log(JSON.stringify(event));
      let record = event.Records[0];
      var body = JSON.parse(record.body);
      /** Find a courier and attach courier information to the order */
      let courier = "<courier email>";

      // update book quantity
      await updateBookQuantity(body.Input.bookId, body.Input.quantity);

     // throw "Something wrong with Courier API";

      // Attach curier information to the order
      await StepFunction.sendTaskSuccess({
          output: JSON.stringify({ courier }),
          taskToken: body.Token
      }).promise();
  } catch (e) {
      console.log("===== You got an Error =====");
      console.log(e);
      await StepFunction.sendTaskFailure({
          error: "NoCourierAvailable",
          cause: "No couriers are available",
          taskToken: body.Token
      }).promise();
  }
}

module.exports.restoreQuantity = async ({ bookId, quantity }) => {
  let params = {
      TableName: 'bookTable',
      Key: { bookId: bookId },
      UpdateExpression: 'set quantity = quantity + :orderQuantity',
      ExpressionAttributeValues: {
          ':orderQuantity': quantity
      }
  };
  await dynamodb.update(params).promise();
  return "Quantity restored"
}