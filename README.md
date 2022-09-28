# Aztec Frontend Boilerplate

This is an Aztec sample project powered by [Aztec SDK](https://github.com/AztecProtocol/aztec-connect/tree/master/sdk) and bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

By default, the project works with the Aztec Testnet.

## Functions

It allows a user to interact with the Aztec Testnet using Metamask and the Aztec SDK. It includes buttons to:

- Connect to Metamask
- Login (derive your Aztec view key by message signing)
- Log the SDK
- Initialize the users Aztec accounts and log the balances
  - Account with nonce 0 is the privacy account and is not typically used to deposit or transfer funds. It is used for registering account with nonce 1 and decrypting notes.
  - Account with nonce 1 is the spending account. The signing key associated with this account is used to spend notes. It must be registered with account 0 before it can be used.
- Create the singer for account with nonce 1
- Register an Aztec account
- Deposit ETH to account 1 from the connected Metamask account.

For more details on available functions, check `./src`.

## Prerequisites

- Install [Node.js](https://nodejs.org/en/download/)
- Install [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/)

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more about the Aztec SDK on the [Aztec Docs](https://docs.aztec.network/category/sdk).

To learn React, check out the [React documentation](https://reactjs.org/).
