"use strict";

const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

module.exports.checkInventory = async (event) => {
  const { bookId, quantity } = event;

  try {
    const bookRes = await dynamodb
      .get("stepfunction-books", { bookId })
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
    if(error.name === "BookOutOfStock") {
       throw error;
    } else {
      let bookNotFoundError = new Error("The Book is out of stock");
      bookNotFoundError.name = "BookNotFound";
      throw bookNotFoundError;
    }
  }
};
module.exports.calculateTotal = async (event) => {
  return 100;
};
