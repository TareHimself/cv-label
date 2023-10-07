#include "Tensor.h"
#include "xtensor/xadapt.hpp"

using namespace Napi;

Tensor::Tensor(const Napi::CallbackInfo &info) : ObjectWrap(info)
{
    auto env = info.Env();
    std::vector<std::size_t> shape;

    if (info.Length() > 0 && info[0].IsArray())
    {
        auto nodeNums = info[0].As<Napi::Array>();

        for (int i = 0; i < nodeNums.Length(); i++)
        {
            auto num = nodeNums.Get(i).As<Napi::Number>();
            auto type = GetType();

            if (type == FLOAT)
            {
                data.push_back(num.FloatValue());
            }
            else if (type == INTEGER)
            {
                data.push_back(num.Int32Value());
            }
            else
            {
                data.push_back(num.DoubleValue());
            }
        }

        if (info.Length() > 1 && info[1].IsArray())
        {
            auto dims = info[1].As<Napi::Array>();

            for (int i = 0; i < dims.Length(); i++)
            {
                shape.push_back(dims.Get(i).As<Napi::Number>().Int64Value());
            }
        }
    }

    if (shape.size() == 0)
    {
        shape.push_back(data.size());
    }

    m_array = xt::adapt(data, shape);
}

Napi::Value Tensor::Shape(const Napi::CallbackInfo &info)
{
    auto env = info.Env();
    auto shape = m_array.shape();
    auto nodeReturn = Napi::Array::New(env, shape.size());
    int idx = 0;
    for (auto dim : shape)
    {
        nodeReturn.Set(idx, dim);
        idx++;
    }

    return nodeReturn;
}

Napi::Value Tensor::ToArray(const Napi::CallbackInfo &info)
{

    auto env = info.Env();

    auto flattened = xt::reshape_view(m_array, {m_array.size()});

    auto nodeReturn = Napi::Array::New(env, flattened.size());

    int idx = 0;

    for (auto dim : flattened)
    {
        nodeReturn.Set(idx, dim);
        idx++;
    }

    return nodeReturn;
}

EXArrayType Tensor::GetType()
{
    if (std::is_same<T, float>::value)
    {
        return FLOAT;
    }
    else if (type == "int")
    {
        return INTEGER;
    }
    else
    {
        return DOUBLE;
    }
}

Napi::Function Tensor::GetClass(Napi::Env env)
{
    return DefineClass(env, "Tensor", {
                                          Tensor::InstanceMethod("toArray", &Tensor::ToArray),
                                          Tensor::InstanceMethod("shape", &Tensor::Shape),
                                      });
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "XArrayInt"), Tensor<int>::GetClass(env));
    exports.Set(Napi::String::New(env, "XArrayFloat"), Tensor<float>::GetClass(env));
    exports.Set(Napi::String::New(env, "XArrayDouble"), Tensor<double>::GetClass(env));
    return exports;
}

NODE_API_MODULE(addon, Init)
