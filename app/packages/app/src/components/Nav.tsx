import {
  DocsLink,
  GitHubLink,
  Header,
  IconButton,
  SlackLink,
  iconContainer,
} from "@fiftyone/components";
import { ViewBar } from "@fiftyone/core";
import * as fos from "@fiftyone/state";
import { useRefresh } from "@fiftyone/state";
import { isElectron } from "@fiftyone/utilities";
import { DarkMode, LightMode } from "@mui/icons-material";
import { useColorScheme } from "@mui/material";
import React, { Suspense, useEffect, useMemo } from "react";
import ReactGA from "react-ga4";
import { useFragment, usePaginationFragment } from "react-relay";
import { useDebounce } from "react-use";
import {
  useRecoilState,
  useRecoilValue,
  useResetRecoilState,
  useSetRecoilState,
} from "recoil";
import { graphql } from "relay-runtime";
import gaConfig from "../ga";
import DatasetSelector from "./DatasetSelector";
import Teams from "./Teams";
import { NavDatasets$key } from "./__generated__/NavDatasets.graphql";
import { NavFragment$key } from "./__generated__/NavFragment.graphql";
import { DEFAULT_WRITE_KEYS, useAnalyticsInfo } from "@fiftyone/analytics";

const getUseSearch = (fragment: NavDatasets$key) => {
  return (search: string) => {
    const refresh = useRecoilValue(fos.refresher);
    const { data, refetch } = usePaginationFragment(
      graphql`
        fragment NavDatasets on Query
        @refetchable(queryName: "DatasetsPaginationQuery") {
          datasets(search: $search, first: $count, after: $cursor)
            @connection(key: "DatasetsList_query_datasets") {
            total
            edges {
              cursor
              node {
                name
              }
            }
          }
        }
      `,
      fragment
    );

    useDebounce(
      () => {
        refetch({ search });
      },
      200,
      [search, refresh]
    );

    return useMemo(() => {
      return {
        total: data.datasets.total === null ? undefined : data.datasets.total,
        values: data.datasets.edges.map((edge) => edge.node.name),
      };
    }, [data]);
  };
};

export const useGA = (info) => {
  useEffect(() => {
    if (!info || info.doNotTrack) {
      return;
    }
    const dev = info.dev;
    const buildType = dev ? "dev" : "prod";
    ReactGA.initialize(gaConfig.app_ids[buildType], {
      testMode: false,
      gaOptions: {
        storage: "none",
        cookieDomain: "none",
        clientId: info.uid,
        page_location: "omitted",
        page_path: "omitted",
        kind: isElectron() ? "Desktop" : "Web",
        version: info.version,
        context: info.context,
        checkProtocolTask: null, // disable check, allow file:// URLs
      },
    });
  }, [info]);
};

const Nav: React.FC<{
  fragment: NavFragment$key;
  hasDataset: boolean;
}> = ({ fragment, hasDataset }) => {
  const data = useFragment(
    graphql`
      fragment NavFragment on Query {
        ...NavDatasets
        ...NavGA
      }
    `,
    fragment
  );
  const info = useFragment(
    graphql`
      fragment NavGA on Query {
        context
        dev
        doNotTrack
        uid
        version
      }
    `,
    data
  );
  const [analyticsInfo, setAnalyticsInfo] = useAnalyticsInfo();
  useEffect(() => {
    const buildType = info.dev ? "dev" : "prod";
    const writeKey = DEFAULT_WRITE_KEYS[buildType];
    setAnalyticsInfo({
      userId: info.uid,
      userGroup: "fiftyone-oss",
      writeKey,
      doNotTrack: info.doNotTrack,
    });
  }, [info, setAnalyticsInfo]);
  useGA(info);

  const useSearch = getUseSearch(data);
  const refresh = useRefresh();
  const { mode, setMode } = useColorScheme();
  const [_, setTheme] = useRecoilState(fos.theme);

  return (
    <Header
      title={"FiftyOne"}
      onRefresh={refresh}
      navChildren={<DatasetSelector useSearch={useSearch} />}
    >
      {hasDataset && (
        <Suspense fallback={<div style={{ flex: 1 }}></div>}>
          <ViewBar />
        </Suspense>
      )}
      {!hasDataset && <div style={{ flex: 1 }}></div>}
      <div className={iconContainer}>
        <Teams />
        <IconButton
          title={mode === "dark" ? "Light mode" : "Dark mode"}
          onClick={() => {
            const nextMode = mode === "dark" ? "light" : "dark";
            setMode(nextMode);
            setTheme(nextMode);
          }}
          sx={{
            color: (theme) => theme.palette.text.secondary,
            pr: 0,
          }}
        >
          {mode === "dark" ? <LightMode color="inherit" /> : <DarkMode />}
        </IconButton>
        <SlackLink />
        <GitHubLink />
        <DocsLink />
      </div>
    </Header>
  );
};

export default Nav;
