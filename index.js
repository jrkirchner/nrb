// JavaScript file upload AWS Lambda
const Multipart = require("lambda-multipart");
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const uuidv4 = require("uuid/v4");

/**
 * The following block of code assigns an asynchronous function that will parse the files from
 * the Lambda request event and handle them appropriately. If the are no files in the request event,
 * the it will respond directly with a 200 status code. If there are files, each file will be uploaded
 * to an S3 bucket by calling the `uploadFileIntoS3` on each file.
 */
module.exports.upload = async (event, context) => {
  const { fields, files } = await parseMultipartFormData(event);

  if (files == null || files.length == 0) {
    return {
      statusCode: 200,
    };
  }

  await Promise.all(
    files.map(async (file) => {
      await uploadFileIntoS3(file);
    })
  );

  return {
    statusCode: 201,
  };
};


/**
 * A new Promise that will contain an object holding the event request fields and files
 * when the parsing is successful. When the parsing is unsuccessful, the Promise will reject with
 * the error return from the Multipart parser.
 */
const parseMultipartFormData = async (event) => {
  return new Promise((resolve, reject) => {
    const parser = new Multipart(event);

    parser.on("finish", (result) => {
      resolve({ fields: result.fields, files: result.files });
    });

    parser.on("error", (error) => {
      return reject(error);
    });
  });
};

/**
 * This asynchonous function is called with a file and tries to upload the file to the S3 bucket
 * name configured in the `file_s3_bucket_name`environment variable. The file will have a randomly
 * generated key in the S3 bucket, but this might one day need to changed so that the file is stored
 * at a key which is human readable so that it can be more easilly interacted with by the end user
 * if they need to download or otherwise access the file.
 * 
 * If the file upload to S3 fails, the error will be logged to the console and the function will
 * throw the error to be handled by any function that is calling `uploadFileIntoS3`.
 */
const uploadFileIntoS3 = async (file) => {
  const ext = getFileExtension(file);
  const options = {
    Bucket: process.env.file_s3_bucket_name,
    Key: `${uuidv4()}.${ext}`,
    Body: file,
  };

  try {
    await s3.upload(options).promise();
    console.log(
      `File uploaded into S3 bucket: "${process.env.file_s3_bucket_name}", with key: "${fileName}"`
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

/**
 * This function will check the headers of a file, and if the file is a jpeg then it will return a
 * string of "jpg". If the file is anything other than a JPEG or the file has no headers, then 
 * the function will throw an Error.
 * 
 * TODO: this function will need to be extended in the future to handle the various types of files
 * that the end user needs to upload.
 */
const getFileExtension = (file) => {
  const headers = file["headers"];
  if (headers == null) {
    throw new Error(`Missing "headers" from request`);
  }

  const contentType = headers["content-type"];
  if (contentType == "image/jpeg") {
    return "jpg";
  }
  if (contentType == "image/png") {
    return "png";
  }
  if (contentType == "text/html") {
    return "html";
  }
  if (contentType == "text/css") {
    return "css";
  }
  if (contentType == "application/javascript") {
    return "javascript";
  }
  if (contentType == "application/json") {
    return "json";
  }
  
  throw new Error(`Unsupported content type "${contentType}".`);
};
