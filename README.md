# Installation Guide

Follow these steps to install and run the Minecraft Skin System project.

## Prerequisites

Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (version 14 or higher)
- [MongoDB](https://www.mongodb.com/) (running instance)

## Steps

1. **Clone the repository:**

   ```sh
   git clone https://github.com/yourusername/candy-skin.git
   cd candy-skin
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Set up environment variables:**

   Copy the 

.env.example

 file to 

.env

 and update the values as needed:

   ```sh
   cp .env.example .env
   ```

   Edit the 

.env

 file to match your configuration:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://your-mongodb-uri
   SESSION_SECRET=your-very-secure-session-secret
   JWT_SECRET=your-very-secure-jwt-secret
   DOMAIN=https://yourdomain.com
   ```

4. **Generate RSA key pair:**

   Run the script to generate the RSA key pair:

   ```sh
   node utils/generateKeys.js
   ```

5. **Start the server:**

   ```sh
   npm start
   ```

   The server should now be running on the port specified in your 

.env

 file (default is 3000).

## Usage

- Open your browser and navigate to `http://localhost:3000` to access the application.
- Register a new account or log in with an existing account.
- Manage your Minecraft skins and capes through the dashboard.

## Additional Information

- The project uses MongoDB for data storage. Ensure your MongoDB instance is running and accessible.
- The project uses RSA keys for signing and verifying tokens. The keys are generated and stored in the 

keys

 directory.
- The project serves static files (textures) from the 

textures

 directory.

For any issues or contributions, please refer to the [GitHub repository](https://github.com/candied-apple/candy-skin).