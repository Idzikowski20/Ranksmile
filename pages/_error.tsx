import * as Sentry from "@sentry/nextjs";
import Error from "next/error";
import type { NextPageContext } from "next";

const CustomErrorComponent = (props: { statusCode: number }) => {
  return <Error statusCode={props.statusCode} />;
};

CustomErrorComponent.getInitialProps = async (contextData: NextPageContext) => {
  // Sentry temporarily off — re-enable with SENTRY_ENABLED=true
  if (process.env.SENTRY_ENABLED === 'true') {
    // In case this is running in a serverless function, await this in order to give Sentry
    // time to send the error before the lambda exits
    await Sentry.captureUnderscoreErrorException(contextData);
  }

  // This will contain the status code of the response
  return Error.getInitialProps(contextData);
};

export default CustomErrorComponent;
