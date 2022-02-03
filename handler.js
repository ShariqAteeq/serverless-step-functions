"use strict";

const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

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
      let bookNotFoundError = new Error("The Book is out of stock");
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
  await dynamodb.update({
    TableName: "stepfunction-users",
    Key: { userId },
    UpdateExpression: "SET points = :zero",
    
  })
}

module.exports.redeemPoints = async ({ userId, total }) => {
  let orderTotal = total.total;
  const userRes = await dynamodb
    .get({ TableName: "stepfunction-users", Key: { userId } })
    .promise();
  const user = userRes.Item;

  const points = user.points;
  if (orderTotal > points) {
    await deductPoints(userId);
  } else {
    throw new Error("Order total is less than redeem points");
  }
};
module.exports.billCustomer = async ({ book, quantity }) => {
  let total = book.price * quantity;
  return { total };
};
