import * as cfn from '@aws-cdk/aws-cloudformation';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as elasticsearch from '@aws-cdk/aws-elasticsearch';
import * as cdk from '@aws-cdk/core';
import * as customResource from '@aws-cdk/custom-resources';
import * as path from 'path';

export type ElasticsearchClusterSettings = Record<string, any>;

export interface ElasticsearchSettingsProps {
    readonly esDomain: elasticsearch.CfnDomain;
    readonly clusterSettings: ElasticsearchClusterSettings;
}

class ElasticsearchSettingsProvider extends cdk.Construct {
    public readonly provider: customResource.Provider;

    public static getOrCreate(scope: cdk.Construct): customResource.Provider {
        const stack = cdk.Stack.of(scope);
        const id = 'com.isotoma.cdk.custom-resources.es-settings';
        const x = (stack.node.tryFindChild(id) as ElasticsearchSettingsProvider) || new ElasticsearchSettingsProvider(stack, id);
        return x.provider;
    }

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        this.provider = new customResource.Provider(this, 'es-settings-provider', {
            onEventHandler: new lambda.Function(this, 'es-settings-event', {
                code: lambda.Code.fromAsset(path.join(__dirname, 'provider')),
                runtime: lambda.Runtime.NODEJS_12_X,
                handler: 'index.onEvent',
                timeout: cdk.Duration.minutes(5),
                initialPolicy: [
                    new iam.PolicyStatement({
                        resources: ['*'],
                        actions: ['es:ESHttp*'],
                    }),
                ],
            }),
        });
    }
}

export class ElasticsearchSettings extends cdk.Construct {

    constructor(scope: cdk.Construct, id: string, props: ElasticsearchSettingsProps) {
        super(scope, id);

        new cfn.CustomResource(this, 'Resource', {
            provider: ElasticsearchSettingsProvider.getOrCreate(this),
            resourceType: 'Custom::ElasticsearchSettings',
            properties: {
                EsDomainEndpoint: props.esDomain.attrDomainEndpoint,
                ClusterSettingsJson: JSON.stringify(props.clusterSettings),
            },
        });
    }
}
