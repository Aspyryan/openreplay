import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "App/mstore";
import { Button, PageTitle, Loader } from "UI";
import { withSiteId } from "App/routes";
import withModal from "App/components/Modal/withModal";
import DashboardWidgetGrid from "../DashboardWidgetGrid";
import { confirm } from "UI";
import { withRouter, RouteComponentProps } from "react-router-dom";
import { useModal } from "App/components/Modal";
import DashboardModal from "../DashboardModal";
import DashboardEditModal from "../DashboardEditModal";
import AlertFormModal from "App/components/Alerts/AlertFormModal";
import withPageTitle from "HOCs/withPageTitle";
import withReport from "App/components/hocs/withReport";
import DashboardOptions from "../DashboardOptions";
import SelectDateRange from "Shared/SelectDateRange";
import { Tooltip } from "react-tippy";
import Breadcrumb from 'Shared/Breadcrumb';

interface IProps {
    siteId: string;
    dashboardId: any;
    renderReport?: any;
}

type Props = IProps & RouteComponentProps;

function DashboardView(props: Props) {
    const { siteId, dashboardId } = props;
    const { dashboardStore } = useStore();
    const { showModal } = useModal();

    const [focusTitle, setFocusedInput] = React.useState(true);
    const [showEditModal, setShowEditModal] = React.useState(false);

    const showAlertModal = dashboardStore.showAlertModal;
    const loading = dashboardStore.fetchingDashboard;
    const dashboard: any = dashboardStore.selectedDashboard;
    const period = dashboardStore.period;

    const queryParams = new URLSearchParams(props.location.search);

    const trimQuery = () => {
        if (!queryParams.has("modal")) return;
        queryParams.delete("modal");
        props.history.replace({
            search: queryParams.toString(),
        });
    };
    const pushQuery = () => {
        if (!queryParams.has("modal")) props.history.push("?modal=addMetric");
    };

    useEffect(() => {
        if (queryParams.has("modal")) {
            onAddWidgets();
            trimQuery();
        }
    }, []);

    useEffect(() => {
        const isExists = dashboardStore.getDashboardById(dashboardId);
        if (!isExists) {
            props.history.push(withSiteId(`/dashboard`, siteId))
        }
    }, [dashboardId])

    useEffect(() => {
        if (!dashboard || !dashboard.dashboardId) return;
        dashboardStore.fetch(dashboard.dashboardId);
    }, [dashboard]);

    const onAddWidgets = () => {
        dashboardStore.initDashboard(dashboard);
        showModal(
            <DashboardModal
                siteId={siteId}
                onMetricAdd={pushQuery}
                dashboardId={dashboardId}
            />,
            { right: true }
        );
    };

    const onEdit = (isTitle: boolean) => {
        dashboardStore.initDashboard(dashboard);
        setFocusedInput(isTitle);
        setShowEditModal(true);
    };

    const onDelete = async () => {
        if (
            await confirm({
                header: "Confirm",
                confirmButton: "Yes, delete",
                confirmation: `Are you sure you want to permanently delete this Dashboard?`,
            })
        ) {
            dashboardStore.deleteDashboard(dashboard).then(() => {
                props.history.push(withSiteId(`/dashboard`, siteId));
            });
        }
    };

    if (!dashboard) return null;

    return (
        <Loader loading={loading}>
            <div style={{ maxWidth: "1300px", margin: "auto" }}>
                <DashboardEditModal
                    show={showEditModal}
                    closeHandler={() => setShowEditModal(false)}
                    focusTitle={focusTitle}
                />
                <Breadcrumb
                    items={[
                        {
                            label: 'Dashboards',
                            to: withSiteId('/dashboard', siteId),
                        },
                        { label: dashboard && dashboard.name || '' },
                    ]}
                />
                <div className="flex items-center mb-4 justify-between">
                    <div className="flex items-center" style={{ flex: 3 }}>
                        <PageTitle
                            // @ts-ignore
                            title={
                                <Tooltip
                                    delay={100}
                                    arrow
                                    title="Double click to rename"
                                >
                                    {dashboard?.name}
                                </Tooltip>
                            }
                            onDoubleClick={() => onEdit(true)}
                            className="mr-3 select-none hover:border-dotted hover:border-b border-gray-medium cursor-pointer"
                            actionButton={
                                <Button
                                    variant="primary"
                                    onClick={onAddWidgets}
                                >
                                    Add Metric
                                </Button>
                            }
                        />
                    </div>
                    <div
                        className="flex items-center"
                        style={{ flex: 1, justifyContent: "end" }}
                    >
                        <div
                            className="flex items-center flex-shrink-0 justify-end"
                            style={{ width: "300px" }}
                        >
                            <SelectDateRange
                                style={{ width: "300px" }}
                                period={period}
                                onChange={(period: any) =>
                                    dashboardStore.setPeriod(period)
                                }
                                right={true}
                            />
                        </div>
                        <div className="mx-4" />
                        <div className="flex items-center flex-shrink-0">
                            <DashboardOptions
                                editHandler={onEdit}
                                deleteHandler={onDelete}
                                renderReport={props.renderReport}
                                isTitlePresent={!!dashboard?.description}
                            />
                        </div>
                    </div>
                </div>
                <div>
                    <h2 
                        className="my-4 w-fit font-normal color-gray-dark border-dashed border-b cursor-pointer border-b-gray-medium"
                        onDoubleClick={() => onEdit(false)}
                    >
                        {dashboard?.description || "Describe the purpose of this dashboard"}
                    </h2>
                </div>
                <DashboardWidgetGrid
                    siteId={siteId}
                    dashboardId={dashboardId}
                    onEditHandler={onAddWidgets}
                    id="report"
                />
                <AlertFormModal
                    showModal={showAlertModal}
                    onClose={() =>
                        dashboardStore.updateKey("showAlertModal", false)
                    }
                />
            </div>
        </Loader>
    );
}

export default withPageTitle("Dashboards - OpenReplay")(
    withReport(withRouter(withModal(observer(DashboardView))))
);
